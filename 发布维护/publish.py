#!/usr/bin/env python3
"""双平台发布：先校验，再同步源码；--publish 发布版本说明，平台生成源码 ZIP；用户 ZIP 为可选附件。"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import tempfile
import urllib.error
import urllib.parse
import urllib.request
import uuid

from release_check import inventory, check_archive

HERE = Path(__file__).resolve().parent


def run(args, cwd=None, input=None, timeout=None):
    # 首次资料库推送可能较大；中断时清理整个进程组，避免遗留并发上传。
    if timeout is None: timeout = 1800 if args[0] == 'git' and 'push' in args else 300
    p = subprocess.Popen(args, cwd=cwd, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                         stderr=subprocess.PIPE, text=True, start_new_session=True)
    try:
        stdout, _ = p.communicate(input=input, timeout=timeout)
    except (subprocess.TimeoutExpired, KeyboardInterrupt):
        try: os.killpg(p.pid, signal.SIGTERM)
        except ProcessLookupError: pass
        try: p.communicate(timeout=5)
        except subprocess.TimeoutExpired:
            try: os.killpg(p.pid, signal.SIGKILL)
            except ProcessLookupError: pass
            p.communicate()
        raise RuntimeError('命令超时或被中断；已停止本次子进程，须先核对远端状态') from None
    if p.returncode:
        raise RuntimeError('命令失败：' + args[0] + ' ' + args[1] + '；请检查网络或仓库权限')
    return stdout.strip()


def sha(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''): h.update(chunk)
    return h.hexdigest()


NOTE_SECTIONS = ('版本概述', '新增功能', '优化改进', '问题修复', '兼容性与影响', '验证结果', '已知限制', '升级与回退')


def release_notes(config):
    """发版说明是版本输入；缺失、占位或版本不匹配均在联网前阻断。"""
    version = config['version']
    if not re.fullmatch(r'\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?', version):
        raise ValueError('版本号不符合发布格式')
    path = HERE / 'release-notes' / ('v' + version + '.md')
    raw = path.read_text(encoding='utf-8')
    front = re.match(r'\A---\n(.*?)\n---\n', raw, re.S)
    if not front: raise ValueError('发版说明缺少元数据')
    fields = dict(re.findall(r'^([a-z_]+):\s*"([^"\n]*)"\s*$', front.group(1), re.M))
    if fields.get('version') != version: raise ValueError('发版说明版本与配置不一致')
    expected_status = 'candidate' if '-' in version else 'stable'
    if fields.get('release_status') != expected_status: raise ValueError('发版说明状态与版本类型不一致')
    body = raw[front.end():].strip()
    if re.search(r'TODO|TBD|待填写|待补充|<[^>]+>', body, re.I): raise ValueError('发版说明仍有占位内容')
    sections = re.split(r'^## (.+)\n', body, flags=re.M)
    found = dict(zip(sections[1::2], sections[2::2]))
    if tuple(sections[1::2]) != NOTE_SECTIONS or any(not found[k].strip() for k in NOTE_SECTIONS):
        raise ValueError('发版说明章节缺失、重复或内容为空')
    if not body.startswith('# ' + config['display_name'] + ' v' + version + '\n'):
        raise ValueError('发版说明标题与产品版本不一致')
    return body


class SafeRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if urllib.parse.urlsplit(newurl).scheme != 'https':
            raise RuntimeError('拒绝不安全的下载重定向')
        redirected = super().redirect_request(req, fp, code, msg, headers, newurl)
        if urllib.parse.urlsplit(req.full_url).netloc != urllib.parse.urlsplit(newurl).netloc:
            redirected.remove_header('Authorization')
        return redirected


class API:
    def __init__(self, base, token, upload_base=None):
        self.base = base.rstrip('/')
        self.token = token
        self.upload_base = upload_base or base
        self.opener = urllib.request.build_opener(SafeRedirect())

    def request(self, path, method='GET', data=None, content_type=None, missing=False, digest=False):
        headers = {'Authorization': 'Bearer ' + self.token, 'Accept': 'application/octet-stream' if digest else 'application/json', 'User-Agent': 'CC-Forge-Release'}
        if content_type: headers['Content-Type'] = content_type
        req = urllib.request.Request(self.base + path, data=data, headers=headers, method=method)
        try:
            with self.opener.open(req, timeout=120) as response:
                if digest:
                    h = hashlib.sha256()
                    for chunk in iter(lambda: response.read(1024 * 1024), b''): h.update(chunk)
                    return h.hexdigest()
                return json.load(response)
        except urllib.error.HTTPError as e:
            if missing and e.code == 404: return None
            raise RuntimeError('发布接口返回 HTTP ' + str(e.code)) from None
        except (urllib.error.URLError, TimeoutError, ValueError):
            raise RuntimeError('发布接口网络或响应异常；已停止，不自动重复写入') from None

    def fields(self, path, method, values):
        return self.request(path, method, urllib.parse.urlencode(values).encode(), 'application/x-www-form-urlencoded')

    def upload(self, path, file):
        boundary = 'ccforge' + uuid.uuid4().hex
        name = file.name
        if any(c in name for c in '\r\n"'): raise ValueError('附件名称包含非法字符')
        body = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{name}"\r\n'
                'Content-Type: application/octet-stream\r\n\r\n').encode() + file.read_bytes() + f'\r\n--{boundary}--\r\n'.encode()
        return self.request(path, 'POST', body, 'multipart/form-data; boundary=' + boundary)


def connections(config):
    repos = {k: config['platforms'][k]['repository'] for k in ('github', 'gitee')}
    for value in repos.values():
        if not isinstance(value, str) or not re.fullmatch(r'[\w.-]+/[\w.-]+', value): raise ValueError('仓库归属未配置')
    fields = f"protocol=https\nhost=gitee.com\npath={repos['gitee']}.git\nusername={repos['gitee'].split('/')[0]}\n\n"
    saved = run(['git', 'credential-osxkeychain', 'get'], input=fields)
    token = dict(line.split('=', 1) for line in saved.splitlines() if '=' in line).get('password')
    if not token: raise ValueError('尚未配置本项目 Gitee 钥匙串凭据')
    apis = {'github': API('https://api.github.com', run(['gh', 'auth', 'token']), 'https://uploads.github.com'), 'gitee': API('https://gitee.com/api/v5', token)}
    for platform, api in apis.items():
        info = api.request('/repos/' + repos[platform])
        if info.get('private') is not True: raise ValueError(platform + ' 目标不是已确认的私有仓库')
    return repos, apis


def git(platform, repo, args, cwd=None):
    helper = '!gh auth git-credential' if platform == 'github' else 'osxkeychain'
    return run(['git', '-c', 'credential.helper=', '-c', 'credential.helper=' + helper,
                '-c', 'credential.useHttpPath=true'] + args, cwd=cwd)


def synchronize(config, repos, apis):
    root = (HERE / config['source']).resolve()
    head = {}
    for platform, repo in repos.items():
        output = git(platform, repo, ['ls-remote', 'https://' + ('github.com' if platform == 'github' else 'gitee.com') + '/' + repo + '.git', 'refs/heads/main'])
        head[platform] = output.split()[0] if output else None
    if head['gitee'] and not head['github']: raise ValueError('仅Gitee存在源码，须先确认主维护来源')
    with tempfile.TemporaryDirectory(prefix='cc-forge-source-') as folder:
        checkout = Path(folder)
        if head['github']:
            git('github', repos['github'], ['clone', '--quiet', '--branch', 'main', '--single-branch', 'https://github.com/' + repos['github'] + '.git', folder])
        else:
            run(['git', 'init', '-q', '-b', 'main', folder])
        if head['gitee'] and head['gitee'] != head['github']:
            # 仅恢复 GitHub 已推进、Gitee 落后的非分叉情况，始终禁止强制推送。
            git('gitee', repos['gitee'], ['fetch', '--quiet', 'https://gitee.com/' + repos['gitee'] + '.git', 'main'], cwd=folder)
            run(['git', 'merge-base', '--is-ancestor', head['gitee'], head['github']], cwd=folder)
        source_files = inventory(root)
        allowed = {'.git', '.gitignore', '.gitattributes', '发布维护'} | {Path(n).parts[0] for n in source_files}
        if any(p.name not in allowed for p in checkout.iterdir()): raise ValueError('远端含未纳入发布管理的文件，停止覆盖')
        archived_notes = {}
        old_notes = checkout / '发布维护' / 'release-notes'
        if old_notes.exists(): archived_notes = {p.name: p.read_bytes() for p in old_notes.glob('v*.md')}
        for path in checkout.iterdir():
            if path.name == '.git': continue
            if path.is_dir(): shutil.rmtree(path)
            else: path.unlink()
        for name, record in source_files.items():
            target = checkout / name
            target.parent.mkdir(parents=True, exist_ok=True); shutil.copy2(root / name, target)
            if sha(target) != record['sha256']: raise ValueError('复制时源文件发生变化，停止同步')
        maintenance = checkout / '发布维护'; maintenance.mkdir()
        for name in ('publish.py', 'release_check.py', 'configure_gitee_auth.py', '配置Gitee发布授权.command', 'README.md'):
            shutil.copy2(HERE / name, maintenance / name)
        remote_config = dict(config, source='..', manuals=['../使用说明.md'])
        notes_dir = maintenance / 'release-notes'; notes_dir.mkdir()
        for name, content in archived_notes.items(): (notes_dir / name).write_bytes(content)
        for note in (HERE / 'release-notes').glob('*.md'):
            target = notes_dir / note.name
            if target.exists() and target.read_bytes() != note.read_bytes():
                for platform, api in apis.items():
                    old_release = api.request('/repos/' + repos[platform] + '/releases/tags/' + note.stem, missing=True)
                    if old_release: raise ValueError('已建发行版说明不可覆盖：' + note.name)
            shutil.copy2(note, target)
        if (HERE / 'tests').exists(): shutil.copytree(HERE / 'tests', maintenance / 'tests', ignore=shutil.ignore_patterns('__pycache__', '*.pyc'))
        (maintenance / 'release.json').write_text(json.dumps(remote_config, ensure_ascii=False, indent=2) + '\n')
        (checkout / '.gitignore').write_text('.DS_Store\n__MACOSX/\n__pycache__/\n*.pyc\n.env\n')
        (checkout / '.gitattributes').write_text('/发布维护 export-ignore\n/.gitignore export-ignore\n/.gitattributes export-ignore\n')
        # 文件已按发布清单复制；强制纳入，避免来源 .gitignore 静默漏掉运行依赖。
        run(['git', 'add', '--force', '--all'], cwd=folder)
        changed = run(['git', 'diff', '--cached', '--name-only'], cwd=folder)
        if changed:
            identity = apis['github'].request('/user')
            run(['git', '-c', 'user.name=' + identity['login'], '-c', f"user.email={identity['id']}+{identity['login']}@users.noreply.github.com", 'commit', '-q', '-m', 'Prepare CC Weaver Secondev Forge v' + config['version']], cwd=folder)
        commit = run(['git', 'rev-parse', 'HEAD'], cwd=folder)
        for platform, repo in repos.items():
            host = 'github.com' if platform == 'github' else 'gitee.com'
            git(platform, repo, ['push', 'https://' + host + '/' + repo + '.git', 'HEAD:refs/heads/main'], cwd=folder)
            actual = git(platform, repo, ['ls-remote', 'https://' + host + '/' + repo + '.git', 'refs/heads/main']).split()[0]
            if actual != commit: raise ValueError(platform + ' 源码提交核对失败')
            print(platform + ' source synchronized: ' + commit, flush=True)
    return commit


def publish(config, repos, apis, archive, commit):
    root = (HERE / config['source']).resolve()
    if archive: check_archive(archive, inventory(root))
    files = [archive] if archive else []
    if any(p.stat().st_size > 100000000 for p in files): raise ValueError('附件超过当前 Gitee 100M预检阈值，尚未上传；需确认实际限额或另配私有下载地址')
    if archive and archive.name != config['archive_name']: raise ValueError('ZIP文件名应为 ' + config['archive_name'])
    tag = 'v' + config['version']; pending = '-' in config['version']
    checksums = {p.name: sha(p) for p in files}
    notes = release_notes(config)
    source_digest = hashlib.sha256(json.dumps(inventory(root), sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    marker = 'CC-FORGE-SOURCE: ' + commit + '\nCC-FORGE-TREE-SHA256: ' + source_digest + '\n' + json.dumps(checksums, ensure_ascii=False, sort_keys=True)
    body = notes + '\n\n---\n\n源码与可选附件追溯（SHA256）：\n\n```text\n' + marker + '\n```'
    releases = {}
    # 先核对两端既有发行版；不同内容的同版本绝不覆盖。
    for platform, api in apis.items():
        path = '/repos/' + repos[platform] + '/releases'
        existing = api.request(path + '/tags/' + tag, missing=True)
        if existing and body != existing.get('body', ''): raise ValueError(platform + ' 同版本内容不同，须使用新版本')
        releases[platform] = existing
    for platform, api in apis.items():
        path = '/repos/' + repos[platform] + '/releases'
        release = releases[platform]
        if not release:
            values = {'tag_name': tag, 'name': config['display_name'] + ' ' + tag + ' [上传中]', 'body': body, 'target_commitish': commit}
            if platform == 'github':
                values.update(draft=True, prerelease=pending)
                release = api.request(path, 'POST', json.dumps(values).encode(), 'application/json')
            else:
                values['prerelease'] = 'true'
                release = api.fields(path, 'POST', values)
        rid = str(release['id'])
        attachments = api.request(path + '/' + rid + ('/assets?per_page=100' if platform == 'github' else '/attach_files?per_page=100'))
        if len(attachments) >= 100: raise ValueError('发行附件数量异常，停止处理')
        if any(a['name'] not in checksums for a in attachments): raise ValueError('发行版有未核对附件，停止处理')
        for file in files:
            matches = [a for a in attachments if a['name'] == file.name]
            if len(matches) > 1: raise ValueError('发行版有同名附件，停止处理')
            item = matches[0] if matches else None
            if not item:
                if platform == 'github':
                    uploader = API(api.upload_base, api.token)
                    item = uploader.request(path + '/' + rid + '/assets?name=' + urllib.parse.quote(file.name), 'POST', file.read_bytes(), 'application/octet-stream')
                else:
                    item = api.upload(path + '/' + rid + '/attach_files', file)
            download = path + '/assets/' + str(item['id']) if platform == 'github' else path + '/' + rid + '/attach_files/' + str(item['id']) + '/download'
            digest = api.request(download, digest=True)
            if digest != checksums[file.name]: raise ValueError(platform + ' 附件下载校验失败；停止发布，不自动删除或覆盖')
            print(platform + ' verified attachment: ' + file.name, flush=True)
        releases[platform] = release
    # 两端所有附件均回下载核验后，才去掉上传中状态。
    for platform, api in apis.items():
        values = {'name': config['display_name'] + ' ' + tag, 'body': body, 'prerelease': pending}
        path = '/repos/' + repos[platform] + '/releases/' + str(releases[platform]['id'])
        if platform == 'github':
            values['draft'] = False
            api.request(path, 'PATCH', json.dumps(values).encode(), 'application/json')
        else:
            values.update(tag_name=tag, prerelease='true' if pending else 'false')
            api.fields(path, 'PATCH', values)
        verified = api.request(path)
        if verified.get('body') != body or verified.get('name') != values['name'] or verified.get('prerelease') is not pending:
            raise ValueError(platform + ' 发行状态回读不一致')
        if platform == 'github' and verified.get('draft') is not False: raise ValueError('GitHub发行版仍为草稿')
        print(platform + ' release published: ' + tag, flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check-notes', action='store_true', help='只核验本版发版说明，不联网')
    parser.add_argument('--sync-source', action='store_true')
    parser.add_argument('--archive', type=Path)
    parser.add_argument('--publish', action='store_true')
    args = parser.parse_args()
    config = json.loads((HERE / 'release.json').read_text())
    release_notes(config)
    if args.check_notes:
        if args.publish or args.sync_source or args.archive: raise ValueError('--check-notes不能与发布参数混用')
        print('Release notes validated: v' + config['version']); return
    root = (HERE / config['source']).resolve()
    if not root.is_relative_to(HERE.parent.resolve()): raise ValueError('源文件目录越界')
    metadata = (root / 'SKILL.md').read_text()
    match = re.search(r'^\s+version:\s*"([^"]+)"', metadata, re.M)
    if not match or match.group(1) != config['version']: raise ValueError('发布版本与Skill不一致')
    for relative in config['manuals']:
        manual = (HERE / relative).resolve()
        if not manual.is_relative_to(HERE.parent.resolve()) or not manual.is_file(): raise ValueError('使用说明路径无效')
        if args.publish and manual.stat().st_size > 100000000: raise ValueError('使用说明超过Gitee附件预检阈值')
    if args.archive:
        if args.archive.name != config['archive_name']: raise ValueError('ZIP名称与配置不一致')
        check_archive(args.archive, inventory(root))
        if args.archive.stat().st_size > 100000000: raise ValueError('ZIP超过Gitee附件预检阈值，未执行写入')
    repos, apis = connections(config)
    print('Both private repositories authenticated', flush=True)
    if not args.sync_source and not args.publish: return
    commit = synchronize(config, repos, apis)
    if args.publish: publish(config, repos, apis, args.archive.resolve() if args.archive else None, commit)


if __name__ == '__main__':
    try: main()
    except Exception as error:
        print(json.dumps({'status': 'stopped', 'reason': str(error), 'note': '可能已完成部分远端步骤；不自动回滚或覆盖。核对后可重跑，已存在的相同附件会校验。'}, ensure_ascii=False))
        raise SystemExit(1)

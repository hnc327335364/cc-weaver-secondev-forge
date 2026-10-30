#!/usr/bin/env python3
"""核对待发布源文件及用户制作的ZIP；不压缩、不上传、不修改仓库。"""
import argparse
import hashlib
import json
import re
import stat
import zipfile
from pathlib import Path, PurePosixPath


def inventory(root):
    files = {}
    for path in sorted(root.rglob('*')):
        if path.relative_to(root).parts[0] in {'.git', '发布维护', '.gitignore', '.gitattributes'}:
            continue
        if path.is_symlink():
            raise ValueError('发布源包含符号链接：'+str(path.relative_to(root)))
        if not path.is_file():
            continue
        relative=path.relative_to(root)
        if path.name=='.DS_Store' or '__pycache__' in relative.parts or path.suffix=='.pyc':
            continue
        if '.git' in relative.parts or '__MACOSX' in relative.parts:
            raise ValueError('发布源混入维护目录：'+relative.as_posix())
        files[relative.as_posix()]={'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
    return files


def check_archive(path, expected):
    actual={}
    with zipfile.ZipFile(path) as archive:
        for item in archive.infolist():
            if item.is_dir():
                continue
            value=PurePosixPath(item.filename)
            if (value.is_absolute() or '..' in value.parts or '\\' in item.filename
                    or ':' in item.filename or value.as_posix()!=item.filename
                    or not value.parts or value.parts[0]!='weaver-cc-assistant'):
                raise ValueError('ZIP必须以weaver-cc-assistant为唯一根目录，且不含异常路径')
            if stat.S_ISLNK(item.external_attr >> 16):
                raise ValueError('ZIP不允许符号链接')
            relative=PurePosixPath(*value.parts[1:]).as_posix()
            if relative in actual or relative not in expected:
                raise ValueError('ZIP包含重复或非发布文件：'+relative)
            if item.file_size!=expected[relative]['bytes']:
                raise ValueError('ZIP文件长度不匹配：'+relative)
            digest=hashlib.sha256()
            with archive.open(item) as stream:
                for chunk in iter(lambda:stream.read(1024*1024),b''): digest.update(chunk)
            actual[relative]={'bytes':item.file_size,'sha256':digest.hexdigest()}
    if actual!=expected:
        raise ValueError('ZIP与本次源文件不一致，存在缺失或内容差异')
    return {'status':'byte-identical','bytes':path.stat().st_size,
            'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
            'gitee_attachment_size_check':'within-100000000-bytes' if path.stat().st_size<=100000000 else 'requires-alternative-download'}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive',type=Path,help='用户制作的ZIP，仅校验，不解压或执行')
    parser.add_argument('--output',type=Path,help='可选：将校验清单保存到指定的新文件')
    args=parser.parse_args()
    home=Path(__file__).resolve().parent
    config=json.loads((home/'release.json').read_text(encoding='utf-8'))
    root=(home/config['source']).resolve()
    if not root.is_relative_to(home.parent.resolve()):
        raise ValueError('发布源必须位于助手目录内')
    files=inventory(root)
    required=['SKILL.md','README.md','library/manifest.json','scripts/library_reader.py','assets/delivery/template.html']
    if any(name not in files for name in required):
        raise ValueError('发布源缺少必需文件')
    version=re.search(r'^\s+version:\s*"([^"]+)"', (root/'SKILL.md').read_text(encoding='utf-8'),re.M)
    if not version or version.group(1)!=config['version']:
        raise ValueError('发布版本与Skill元数据不一致')
    manuals={}
    for name in config['manuals']:
        path=(home/name).resolve()
        if not path.is_relative_to(home.parent.resolve()) or not path.is_file():
            raise ValueError('使用说明路径不合法或缺失')
        manuals[path.name]={'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
    result={'version':config['version'],'source_files':len(files),'source_bytes':sum(r['bytes'] for r in files.values()),
            'files':files,'manuals':manuals,'archive':check_archive(args.archive,files) if args.archive else {'status':'not-provided'},
            'published':False,'publication_pending':['host-acceptance','remote-release-verification'],
            'boundary':'文件一致性校验，不代表三宿主或客户验收；不创建ZIP、不上传、不执行来源程序；手工ZIP为可选校验项'}
    output=json.dumps(result,ensure_ascii=False,indent=2)+'\n'
    if args.output:
        with args.output.open('x',encoding='utf-8') as stream: stream.write(output)
        print(json.dumps({k:v for k,v in result.items() if k!='files'},ensure_ascii=False))
    else:
        print(output,end='')


if __name__=='__main__':
    try: main()
    except (ValueError,OSError,zipfile.BadZipFile) as error:
        print(json.dumps({'error':str(error)},ensure_ascii=False));raise SystemExit(1)

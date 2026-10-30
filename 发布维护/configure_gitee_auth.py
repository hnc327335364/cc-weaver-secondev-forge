#!/usr/bin/env python3
"""由维护者交互输入 Gitee 令牌，仅保存到 macOS Git 钥匙串条目。"""
import getpass
import subprocess
import sys

ACCOUNT = 'hou_nachuan'
REPOSITORY = 'hou_nachuan/cc-weaver-secondev-forge.git'


def main():
    if sys.platform != 'darwin' or not sys.stdin.isatty():
        print('请在本机 macOS 终端中运行；不接受文件或管道传入令牌。')
        return 1
    print('将 Gitee 发布令牌保存到 macOS 钥匙串中的本项目条目。')
    print('输入不会显示；留空可取消。不会上传文件或修改 Git 全局配置。')
    token = getpass.getpass('请粘贴 Gitee 令牌并回车：').strip()
    if not token:
        print('已取消。')
        return 0
    if any(c.isspace() for c in token):
        print('令牌包含空白，未保存。')
        return 1
    # 凭据仅通过标准输入交给系统助手，避免进入命令参数或日志。
    payload = f'protocol=https\nhost=gitee.com\npath={REPOSITORY}\nusername={ACCOUNT}\npassword={token}\n\n'
    result = subprocess.run(['git', 'credential-osxkeychain', 'store'],
                            input=payload, text=True, capture_output=True)
    if result.returncode:
        print('钥匙串保存失败；未输出凭据。请将此提示反馈给维护人员。')
        return 1
    print('已保存到钥匙串。尚未验证远端权限，也未发布版本。')
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (KeyboardInterrupt, EOFError):
        print('\n已取消。')
        raise SystemExit(1)

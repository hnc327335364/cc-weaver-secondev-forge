#!/usr/bin/env python3
"""CC 工具入口：本地工具直接运行，联网/远端写入必须显式声明范围并经用户确认。"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
BASE = "tools/ecode/skills/"
DEV = BASE + "ecode-development/"
TOOLS = {
    "prepare": (DEV + "scripts/prepare-task.mjs", "需求技术分流与风险识别"),
    "route": (DEV + "scripts/route-scenario.mjs", "E10 开发场景分流"),
    "frontend": (DEV + "modules/e10-frontend-local-tooling/scripts/ecodecmd-e10/bin/ecodecmd-e10.mjs", "E10 前端初始化、检查、编译与打包"),
    "backend": (DEV + "modules/backend-project-init/scripts/project-validator.mjs", "E10 后端骨架、模块与依赖检查"),
    "security": (BASE + "ecode-security-review/scripts/review-contract.mjs", "安全审查快照与报告校验"),
    "performance": (BASE + "ecode-performance-review/scripts/review-contract.mjs", "性能审查快照与报告校验"),
    "integration": (BASE + "ecode-integration/scripts/integration.mjs", "组织同步计划、离线预演与受控集成"),
    "login": (BASE + "e10-login-cli/scripts/e10-login-cli.mjs", "非生产 E10 登录及租户操作"),
    "platform": (BASE + "ecode-cli/scripts/ecode-cli.mjs", "非生产 E10 应用、源码与包操作"),
    "pages": (BASE + "weaver-e10-page-generator/scripts/page-agent.mjs", "页面制作运行工具与受控发布"),
}


def has(args, name):
    return any(item == name or item.startswith(name + "=") for item in args)


def value(args, name):
    for index, item in enumerate(args):
        if item.startswith(name + "="):
            return item.split("=", 1)[1]
        if item == name and index + 1 < len(args):
            return args[index + 1]
    return None


def command_args(args):
    """上游平台CLI允许全局state在命令前；分类时移除它，但原样传递已校验参数。"""
    result = []
    index = 0
    while index < len(args):
        item = args[index]
        if item == "--state":
            if index + 1 >= len(args) or args[index + 1].startswith("--"):
                raise ValueError("--state 缺少文件路径")
            index += 2
            continue
        if item.startswith("--state="):
            if not item.split("=", 1)[1]:
                raise ValueError("--state 缺少文件路径")
            index += 1
            continue
        result.append(item)
        index += 1
    return result


def classify(tool, args):
    """只放行已接纳命令；未知命令不因看似只读就自动执行。"""
    for name in ("--state", "--source-out", "--compiled-out"):
        if sum(item == name or item.startswith(name + "=") for item in args) > 1:
            raise ValueError("不接受重复的会话或输出路径参数，避免校验值与实际执行值不一致")
    args = command_args(args)
    if not args:
        raise ValueError("缺少工具参数，请先读取对应专业 Skill")
    cmd = args[0]
    if any(has(args, flag) for flag in ("--force", "--insecure", "--template-url", "--password", "--monitor-password", "--auto-publish", "--cover-config")):
        raise ValueError("拒绝覆盖、关闭证书校验、替换模板或命令行明文密码；请使用安全输入及明确范围")
    if tool in {"prepare", "route"}:
        return False, False
    if tool == "frontend" and cmd in {"help", "--help", "init", "check", "compile", "build"}:
        return False, False
    if tool == "backend":
        if cmd in {"help", "--help", "inspect", "create-module"}:
            return False, False
        if cmd in {"init", "download"}:
            archives = has(args, "--lib-archive-file") and has(args, "--classes-archive-file")
            offline = archives or (cmd == "init" and has(args, "--skeleton-only"))
            return not offline, False
    if tool in {"security", "performance"} and cmd in {"prepare", "validate"}:
        return False, False
    if tool == "integration":
        sub = args[1] if len(args) > 1 else ""
        if cmd == "help" or (cmd == "hr" and sub == "list"):
            return False, False
        if cmd == "sync" and sub in {"plan", "apply"}:
            offline = sub == "plan" or has(args, "--dry-run")
            return not offline, not offline
        if cmd == "e9" and sub in {"read", "snapshot"}:
            return True, False
        if cmd == "oauth" and sub == "check":
            return True, False
        if cmd == "hr" and sub == "call":
            # 操作副作用不能只看 GET/POST；HR call 一律按可能写入处理。
            return True, True
    if tool == "login":
        if cmd in {"help", "--help"}:
            return False, False
        if cmd in {"login", "tenants", "current", "switch"}:
            return True, False
        if cmd == "request":
            raise ValueError("不开放通用 request；请使用已接纳的明确业务工具")
    if tool == "platform":
        if cmd in {"help", "--help"}:
            return False, False
        pair = tuple(args[:2])
        readonly = {("system", "version"), ("project", "list"), ("tree", "list"),
                    ("app", "download"), ("file", "get")}
        writes = {("app", "create"), ("folder", "create"),
                  ("file", "create"), ("file", "update"), ("package", "check"), ("package", "import")}
        if pair in readonly | writes:
            return True, pair in writes
    if tool == "pages":
        if cmd in {"status", "help"}:
            return False, False
        if cmd in {"ensure", "update", "doctor", "protocol", "sync", "plan", "run"}:
            # 首次 run 可下载运行时，构建也可能访问目标系统；不把它误标离线。
            tail = args[args.index("--") + 1:] if "--" in args else []
            first = tail[0] if tail else ""
            if first == "auth" and tail != ["auth", "status"]:
                raise ValueError("页面身份由 login 工具管理，不接入独立认证命令")
            pair = tuple(tail[:2])
            mutation = (first == "data-write"
                        or pair in {("platform", "check"), ("platform", "import"), ("platform", "deploy"),
                                    ("publish-target", "create-eb-page"), ("publish-target", "create-portal-page"),
                                    ("data-plan", "open-config")})
            # build/next 的上游适配器禁止隐式发布；本地打包不能要求远端写授权。
            return True, cmd == "run" and mutation
    raise ValueError("该命令尚未接纳，请读取专业 Skill；不直接绕过统一入口执行")


def check_permission(tool, args, *, allow_network=False, environment=None,
                     confirmed=False, allow_remote_write=False, change_note=None):
    network, write = classify(tool, args)
    if network and not (allow_network and confirmed and environment in {"test", "development"}):
        raise ValueError("此操作可能联网。须确认目标为测试/开发环境，并提供 --allow-network --confirmed --environment test|development；生产或未知环境禁止")
    if write and not (allow_remote_write and change_note and change_note.strip()):
        raise ValueError("此操作可能远端写入。逐次确认环境、租户、用户、变更和恢复办法后，提供 --allow-remote-write --change-note；上游审批仍必须通过")
    return {"network": network, "remote_write": write}


def check_storage(tool, args):
    """会话与运行时不能污染分发包；显式导出不覆盖已有客户文件。"""
    for setting in (value(args, "--state"), os.environ.get("ECODE_PAGE_RUNTIME_HOME")):
        if setting:
            if setting.startswith("~"):
                raise ValueError("请使用已解析的实际路径，不传递不会由Node自动展开的 ~")
            if Path(setting).resolve().is_relative_to(ROOT):
                raise ValueError("会话和页面运行时必须存放在助手包之外，避免随包泄露或重复分发")
    if tool == "platform" and command_args(args)[:2] == ["file", "get"]:
        for name in ("--source-out", "--compiled-out"):
            output = value(args, name)
            if output and os.path.lexists(Path(output)):
                raise ValueError("下载输出已存在，不覆盖客户文件；请另选新的输出路径")


def doctor():
    node = shutil.which("node")
    version = None
    features = {}
    if node:
        result = subprocess.run([node, "--version"], capture_output=True, text=True, timeout=10, check=False)
        if result.returncode == 0:
            version = result.stdout.strip()
        probe = "import fs from 'node:fs/promises'; import util from 'node:util'; console.log(JSON.stringify({statfs:typeof fs.statfs==='function',parseArgs:typeof util.parseArgs==='function',fetch:typeof fetch==='function'}))"
        result = subprocess.run([node, "--input-type=module", "-e", probe], capture_output=True, text=True, timeout=10, check=False)
        if result.returncode == 0:
            features = json.loads(result.stdout)
    major = int(version.lstrip("v").split(".")[0]) if version and version.lstrip("v").split(".")[0].isdigit() else 0
    return {"python": ".".join(map(str, sys.version_info[:3])), "node": version,
            "node_features": features,
            "local_tools_ready": major >= 18 and all(features.get(key) is True for key in ("statfs", "parseArgs", "fetch")) and all((ROOT / item[0]).is_file() for item in TOOLS.values()),
            "tools": [{"id": name, "present": (ROOT / item[0]).is_file()} for name, item in TOOLS.items()],
            "page_runtime": "按需下载，需 Node >=22.5、浏览器及单独授权；本自检不安装也不登录",
            "boundary": "这里只检查本地工具与依赖，不代表宿主自动识别或客户环境验收"}


def main(argv=None):
    argv = list(sys.argv[1:] if argv is None else argv)
    # 第一个 -- 后的字节参数原样传递，不经 shell，也不在日志中复述可能敏感的参数。
    split = argv.index("--") if "--" in argv else len(argv)
    head, forwarded = argv[:split], argv[split + 1:]
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("list")
    commands.add_parser("doctor")
    run = commands.add_parser("run")
    run.add_argument("tool", choices=TOOLS)
    run.add_argument("--allow-network", action="store_true")
    run.add_argument("--environment", choices=("test", "development"))
    run.add_argument("--confirmed", action="store_true")
    run.add_argument("--allow-remote-write", action="store_true")
    run.add_argument("--change-note")
    args = parser.parse_args(head)
    try:
        if args.command == "list":
            result = {"tools": [{"id": key, "purpose": item[1]} for key, item in TOOLS.items()],
                      "boundary": "开关记录已确认范围，不代替用户授权；使用人员不必学习这些命令"}
        elif args.command == "doctor":
            result = doctor()
        else:
            check_permission(args.tool, forwarded, allow_network=args.allow_network,
                             environment=args.environment, confirmed=args.confirmed,
                             allow_remote_write=args.allow_remote_write, change_note=args.change_note)
            check_storage(args.tool, forwarded)
            script = ROOT / TOOLS[args.tool][0]
            if not script.is_file() or script.is_symlink():
                raise ValueError("工具缺失或路径异常，请取得完整工作包")
            node = shutil.which("node")
            if not node:
                raise ValueError("未找到 Node.js；请由接收方确认安装运行环境，不能把资料检索成功当作工具可用")
            return subprocess.run([node, str(script), *forwarded], check=False).returncode
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    except (ValueError, OSError, subprocess.SubprocessError) as error:
        print(json.dumps({"ok": False, "error": str(error) if isinstance(error, ValueError) else type(error).__name__}, ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

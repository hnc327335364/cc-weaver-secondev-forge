#!/usr/bin/env python3
"""三宿主共用的交互安装入口；只复制本 Skill，不修改宿主设置。"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import sqlite3
import sys

sys.dont_write_bytecode = True
if sys.version_info < (3, 9):
    raise SystemExit("需要 Python 3.9 或更高版本；本程序不自动下载。请将 README 交给 AI 协助准备。")
import install_local as installer

LABELS = {"workbuddy": "WorkBuddy", "codex": "Codex", "dsh": "DSH"}
SUCCESS = {"installed", "upgraded", "already-present"}
TRIAL = "请使用 CC 泛微开发助手，查询 E9 流程表单首屏明细汇总的相关资料。本次只读，不改代码；请给出实际读取的随包资料标题和正文依据。"


def absolute_directory(value: str) -> Path:
    path = Path(value).expanduser()
    if not path.is_absolute() or ".." in path.parts:
        raise ValueError("技能根必须是绝对目录，且不能包含 ..")
    return path


def choose_directory(host: str, explicit: Path | None = None,
                     home: Path | None = None, env: dict | None = None) -> Path:
    """优先复用已安装位置；只查看已知根，不读含凭据的宿主配置。"""
    home = home if home is not None else Path.home()
    env = env if env is not None else os.environ
    if host not in LABELS:
        raise ValueError("请选择 WorkBuddy、Codex 或 DSH")
    if explicit is not None:
        return absolute_directory(str(explicit))
    shared = home / ".agents" / "skills"
    if host == "codex":
        candidates = [shared, absolute_directory(env.get("CODEX_HOME") or str(home / ".codex")) / "skills"]
    elif host == "dsh":
        candidates = [absolute_directory(env.get("DSH_HOME") or str(home / ".dsh")) / "skills",
                      absolute_directory(env.get("DSH_AGENTS_HOME") or str(home / ".agents")) / "skills"]
    else:
        if env.get("WORKBUDDY_INSTANCE_NUMBER") and not env.get("WORKBUDDY_CONFIG_DIR"):
            raise ValueError("当前为 WorkBuddy 多实例，请由 AI 核实该实例技能根后用 --skills-dir 指定，不按默认位置安装")
        candidates = [absolute_directory(env.get("WORKBUDDY_CONFIG_DIR") or str(home / ".workbuddy")) / "skills"]
    candidates = list(dict.fromkeys(candidates))
    for root in candidates:
        if os.path.lexists(root / "weaver-department-assistant"):
            raise ValueError("发现旧标识 weaver-department-assistant，请先让 AI 核对并备份迁移：" + str(root))
    installed = [root for root in candidates if os.path.lexists(root / installer.SKILL_NAME)]
    if len(installed) > 1:
        raise ValueError("发现多个同名安装，请先让 AI 核对扫描根及重复项，不继续复制：" + ", ".join(map(str, installed)))
    return installed[0] if installed else candidates[0]


def missing_parents(skills_dir: Path) -> list[Path]:
    # 只创建确认过的父目录；禁止通过符号链接或重解析点绕过安装器边界。
    missing = []
    parent = skills_dir.parent
    while not os.path.lexists(parent):
        missing.append(parent)
        parent = parent.parent
    installer.check_path(parent)
    return list(reversed(missing))


def preview(host: str, skills_dir: Path) -> dict:
    skills_dir = absolute_directory(str(skills_dir))
    source = installer.SOURCE_ROOT
    if skills_dir == source or skills_dir.is_relative_to(source) or source.is_relative_to(skills_dir):
        raise ValueError("安装位置不能与分发包重叠")
    state_root = skills_dir.parent / "weaver-cc-install-state"
    if state_root == skills_dir or state_root.is_relative_to(skills_dir):
        raise ValueError("本地状态目录与技能扫描根重叠")
    target = skills_dir / installer.SKILL_NAME
    for parent in [target] + list(target.parents):
        if os.path.lexists(parent / ".git"):
            raise ValueError("此助手仅支持用户级安装，拒绝安装到 Git 项目内")
    if os.path.lexists(skills_dir / "weaver-department-assistant"):
        raise ValueError("发现旧标识，请先核对并备份迁移，不并排安装")
    missing = missing_parents(skills_dir)
    upgrade = os.path.lexists(skills_dir / installer.SKILL_NAME)
    if missing:
        # 原安装器要求父目录存在；先完整验证来源，确认后才补齐缺失父目录。
        inventory = installer.inventory(source)
        installer.verify_bundle(source / "knowledge")
        installer.verify_layout(source, "full-library")
        result = {"status": "preview", "target": str(skills_dir / installer.SKILL_NAME),
                  "file_count": len(inventory["files"]), "writes": False,
                  "local_state_directory": str(skills_dir.parent / "weaver-cc-install-state"),
                  "staging_parent": str(skills_dir.parent)}
    else:
        result = installer.run(host, skills_dir, upgrade=upgrade)
    return {**result, "host": host, "skills_directory": str(skills_dir),
            "create_parent_directories": list(map(str, missing)), "upgrade": upgrade,
            "directory_basis": "已知默认根、环境变量或显式位置；自定义实例以当前工具实际设置为准",
            "scope": "仅安装此 Skill 及本地状态/备份；不改宿主配置、不改客户项目、不联网、不登录",
            "shared_root_notice": "公共 .agents/skills 也可能被 DSH 等其他工具发现，安装不保证仅对所选工具可见",
            "next_session_prompt": TRIAL}


def execute(plan: dict, accept_local_changes: bool = False) -> dict:
    if plan["status"] == "already-present":
        return plan
    if plan.get("requires_backup_acceptance") and not accept_local_changes:
        raise ValueError("旧版有本地改动或缺少基线，须单独确认仅将其保存在备份、不合入新版")
    skills_dir = Path(plan["skills_directory"])
    current_missing = missing_parents(skills_dir)
    if list(map(str, current_missing)) != plan["create_parent_directories"]:
        raise ValueError("确认期间目录结构发生变化，请重新预览")
    for parent in current_missing:
        installer.check_path(parent.parent)
        parent.mkdir(mode=0o700)
    return installer.run(plan["host"], skills_dir, install=True, upgrade=plan["upgrade"],
                         accept_local_changes_backup=accept_local_changes)


def show_plan(plan: dict) -> None:
    print("\nCC 泛微开发助手（Skill）")
    print("工具：" + LABELS[plan["host"]])
    print("安装位置：" + plan["target"])
    print("本地状态：" + plan["local_state_directory"])
    print("暂存位置：" + plan["staging_parent"])
    for parent in plan["create_parent_directories"]:
        print("将新建目录：" + parent)
    if plan.get("backup_parent"):
        print("旧版备份：" + plan["backup_parent"])
    print(plan["scope"])
    print("若使用自定义技能根/多实例或已禁用默认扫描，请取消并让 AI 核实安装位置。")
    print(plan["shared_root_notice"])


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", choices=tuple(LABELS))
    parser.add_argument("--skills-dir", type=Path, help="自定义实例已核实的技能根")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--preview", action="store_true", help="只读 JSON 预览，供 AI 核对")
    mode.add_argument("--install", action="store_true", help="已确认预览范围后执行，不再交互")
    parser.add_argument("--accept-local-changes-backup", action="store_true")
    args = parser.parse_args()
    try:
        host = args.host
        if host is None:
            if args.preview or args.install:
                raise ValueError("非交互操作须指定 --host")
            answer = input("选择使用工具：1 WorkBuddy / 2 Codex / 3 DSH（输入数字，其他取消）：").strip()
            host = {"1": "workbuddy", "2": "codex", "3": "dsh"}.get(answer)
            if host is None:
                print("已取消，未写入文件。")
                return 0
        plan = preview(host, choose_directory(host, args.skills_dir))
        if args.preview:
            print(json.dumps(plan, ensure_ascii=False, indent=2))
            return 0
        show_plan(plan)
        if plan["status"] == "already-present":
            print("\n同一内容已安装，无需重复复制。")
        else:
            if not args.install and input("\n确认上述位置与范围，安装/升级？输入 y 确认，其他取消：").strip().lower() != "y":
                print("已取消，未写入文件。")
                return 0
            accept = args.accept_local_changes_backup
            if plan.get("requires_backup_acceptance") and not accept and not args.install:
                print("旧版存在本地修改或没有安装基线。这些内容仅完整保存在旧版备份，不自动合入新版。")
                accept = input("接受以上处理？输入 backup 确认，其他取消：").strip() == "backup"
                if not accept:
                    print("已取消，未写入文件。")
                    return 0
            result = execute(plan, accept)
            if result["status"] not in SUCCESS:
                print(json.dumps(result, ensure_ascii=False, indent=2))
                print("安装未完整结束。请保留以上结果交给 AI 检查，不重复安装。")
                return 1
            print("\n文件安装和完整性核对完成。尚需在所选工具中新建会话验证。")
            if result.get("rollback_record"):
                print("回滚记录：" + result["rollback_record"])
        print("\n新建会话，选择 weaver-cc-assistant（CC 泛微开发助手），发送：\n" + TRIAL)
        return 0
    except (ValueError, OSError, UnicodeError, sqlite3.Error) as exc:
        print("未完成：" + str(exc))
        print("请将以上结果和完整包目录交给 AI 核对；不要反复安装或关闭系统安全检查。")
        return 1
    except (EOFError, KeyboardInterrupt):
        print("\n操作已中止。若已开始复制，请让 AI 核对上述安装位置，不直接重试。")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

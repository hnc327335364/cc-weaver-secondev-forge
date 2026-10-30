#!/usr/bin/env python3
"""本地安装、备份升级与回滚；默认预览，不猜宿主路径、不修改配置、不联网。"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sqlite3
import stat
import sys
import tempfile
import unicodedata
from pathlib import Path

# 默认预览也不能因导入阅读器而在包内生成 __pycache__。
sys.dont_write_bytecode = True
from knowledge_reader import RULE_FILES, is_os_metadata, verify_bundle
from library_reader import verify as verify_full_library

SKILL_NAME = "weaver-cc-assistant"
SOURCE_ROOT = Path(os.path.abspath(__file__)).parents[1]
PENDING_ENTRY = "SKILL.md.pending"
HOSTS = ("codex", "workbuddy", "dsh")
PROFESSIONAL_SKILLS = frozenset("weaver-cc-" + name for name in (
    "knowledge", "e9-development", "e10-development", "integration", "security-review",
    "performance-review", "e10-platform", "e10-pages"))
BOUNDARY = "完整复制不等于宿主已识别。请在目标宿主新会话中确认技能，并实际检索和读取完整资料库的一份正文；Windows 和各宿主的自动加载须分别实测。"


def inventory_digest(value: dict) -> str:
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True,
                                     separators=(",", ":")).encode("utf-8")).hexdigest()


def validate_inventory(value: dict) -> dict:
    """状态记录只接受规范的相对路径，不能借恢复记录写到包目录之外。"""
    if not isinstance(value, dict) or set(value) != {"directories", "files"}:
        raise ValueError("安装记录的文件清单格式错误")
    if not isinstance(value["directories"], list) or not isinstance(value["files"], dict):
        raise ValueError("安装记录的文件清单格式错误")
    paths = value["directories"] + list(value["files"])
    if not all(isinstance(relative, str) for relative in paths):
        raise ValueError("安装记录包含非法路径")
    if len(paths) != len(set(paths)):
        raise ValueError("安装记录包含重复路径")
    for relative in paths:
        if not isinstance(relative, str) or not relative or Path(relative).as_posix() != relative:
            raise ValueError("安装记录包含非法路径")
        if Path(relative).is_absolute() or any(part in {".", ".."} for part in relative.split("/")):
            raise ValueError("安装记录包含越界路径")
        for part in relative.split("/"):
            validate_name(part)
    for record in value["files"].values():
        if (not isinstance(record, dict) or set(record) != {"sha256", "bytes"}
                or not isinstance(record["sha256"], str) or not re.fullmatch(r"[0-9a-f]{64}", record["sha256"])
                or type(record["bytes"]) is not int or record["bytes"] < 0):
            raise ValueError("安装记录包含非法指纹")
    return value


def state_paths(skills_dir: Path) -> tuple[Path, Path]:
    root = skills_dir.parent / "weaver-cc-install-state"
    # 状态目录必须位于本次确认的技能扫描根之外，不能用特殊目录名使两者重叠。
    if root == skills_dir or root.is_relative_to(skills_dir):
        raise ValueError("本地状态目录与技能扫描根重叠")
    check_path(root, allow_missing_leaf=True)
    key = hashlib.sha256(str(skills_dir / SKILL_NAME).encode("utf-8")).hexdigest()[:24]
    return root, root / (key + ".json")


def read_json_record(path: Path) -> dict:
    if not stat.S_ISREG(checked_stat(path).st_mode) or path.stat().st_size > 64 * 1024 * 1024:
        raise ValueError("安装记录必须是大小受限的普通文件")
    with path.open(encoding="utf-8") as stream:
        value = json.load(stream)
    if not isinstance(value, dict):
        raise ValueError("安装记录格式错误")
    return value


def baseline(skills_dir: Path, target: Path) -> dict | None:
    _, path = state_paths(skills_dir)
    if not os.path.lexists(path):
        return None
    data = read_json_record(path)
    if data.get("schema_version") != 1 or data.get("target") != str(target):
        raise ValueError("本地安装基线不属于当前目标")
    if data.get("baseline_available") is False:
        return None
    value = validate_inventory(data.get("inventory"))
    if inventory_digest(value) != data.get("inventory_sha256"):
        raise ValueError("本地安装基线指纹不符")
    return value


def save_baseline(skills_dir: Path, target: Path, value: dict | None) -> None:
    root, path = state_paths(skills_dir)
    if not root.exists():
        root.mkdir(mode=0o700)
    check_path(root)
    if os.path.lexists(path):
        baseline(skills_dir, target)  # 不覆盖链接、不相关记录或损坏基线。
    record = {"schema_version": 1, "target": str(target), "inventory": value,
              "baseline_available": value is not None,
              "inventory_sha256": inventory_digest(value) if value is not None else None}
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", prefix="state-", suffix=".pending",
                                     dir=root, delete=False) as stream:
        temporary = Path(stream.name)
        json.dump(record, stream, ensure_ascii=False, separators=(",", ":"))
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temporary, path)


def differences(current: dict, previous: dict | None) -> dict:
    if previous is None:
        return {"baseline": "unavailable", "changed": [], "missing": [], "unmanaged": [],
                "requires_backup_acceptance": True}
    changed = [name for name, record in previous["files"].items()
               if name in current["files"] and current["files"][name] != record]
    missing = sorted(set(previous["files"]) - set(current["files"]))
    unmanaged = sorted(set(current["files"]) - set(previous["files"]))
    extra_dirs = sorted(set(current["directories"]) - set(previous["directories"]))
    return {"baseline": "available", "changed": sorted(changed), "missing": missing,
            "unmanaged": unmanaged, "extra_directories": extra_dirs,
            "requires_backup_acceptance": bool(changed or missing or unmanaged or extra_dirs)}


def check_backup_parent(parent: Path, skills_dir: Path, source: Path) -> None:
    check_path(parent, allow_missing_leaf=True)
    if (parent == skills_dir or parent.is_relative_to(skills_dir)
            or parent == source or parent.is_relative_to(source)):
        raise ValueError("备份位置必须位于已确认技能扫描根和分发包之外")
    existing = parent if parent.exists() else parent.parent
    if existing.stat().st_dev != skills_dir.stat().st_dev:
        raise ValueError("备份与技能目录必须同卷，以便保留原目录并可恢复")


def backup_record(folder: Path, host: str, skills_dir: Path, value: dict, layout: str) -> Path:
    path = folder / "restore.json"
    managed = baseline(skills_dir, skills_dir / SKILL_NAME)
    record = {"schema_version": 1, "host": host, "target": str(skills_dir / SKILL_NAME),
              "inventory": value, "inventory_sha256": inventory_digest(value),
              "managed_baseline": managed,
              "managed_baseline_sha256": inventory_digest(managed) if managed is not None else None,
              "package": "package", "layout": layout,
              "boundary": "本地备份，不是签名发布物；恢复前重新逐文件校验。"}
    with path.open("x", encoding="utf-8") as stream:
        json.dump(record, stream, ensure_ascii=False, separators=(",", ":"))
    return path


def load_backup(path: Path, host: str, skills_dir: Path) -> tuple[Path, dict, dict | None, str]:
    if path.name != "restore.json":
        raise ValueError("回滚参数必须指向备份中的 restore.json")
    check_path(path.parent)
    check_backup_parent(path.parent, skills_dir, SOURCE_ROOT)
    record = read_json_record(path)
    if (record.get("schema_version") != 1 or record.get("host") != host
            or record.get("target") != str(skills_dir / SKILL_NAME) or record.get("package") != "package"):
        raise ValueError("备份记录不属于本次宿主和目标，或包含越界包路径")
    expected = validate_inventory(record.get("inventory"))
    if inventory_digest(expected) != record.get("inventory_sha256"):
        raise ValueError("备份记录指纹不符")
    managed = record.get("managed_baseline")
    if managed is not None:
        managed = validate_inventory(managed)
        if inventory_digest(managed) != record.get("managed_baseline_sha256"):
            raise ValueError("备份中的受管基线指纹不符")
    package = path.parent / "package"
    if inventory(package) != expected:
        raise ValueError("备份内容已改变，拒绝恢复")
    layout = restorable_layout(package)
    if record.get("layout", layout) != layout:
        raise ValueError("备份记录声明的布局与实际包不符")
    return package, expected, managed, layout


def validate_name(name: str) -> None:
    """按 Windows/macOS 共同可用的文件名约束拒绝不可移植内容。"""
    if (not name or name.startswith(".") or name.endswith((".", " "))
            or re.search(r'[<>:"/\\|?*\x00-\x1f]', name)):
        raise ValueError("包内含隐藏或 Windows 不合法的文件名")
    stem = name.split(".", 1)[0].upper()
    if stem in {"CON", "PRN", "AUX", "NUL"} or re.fullmatch(r"(?:COM|LPT)[1-9¹²³]", stem):
        raise ValueError("包内含 Windows 保留文件名")
    if name.casefold() in RULE_FILES | {"agents.override.md", "claude.local.md", "copilot-instructions.md"}:
        raise ValueError("包内不能携带项目或宿主规则文件")


def checked_stat(path: Path):
    info = path.lstat()
    attributes = getattr(info, "st_file_attributes", 0)
    if stat.S_ISLNK(info.st_mode) or attributes & 0x400:
        raise ValueError("拒绝符号链接和 Windows 重解析点")
    return info


def check_path(path: Path, allow_missing_leaf: bool = False) -> None:
    if not path.is_absolute() or ".." in path.parts:
        raise ValueError("目标必须是明确的绝对路径，不能含 ..")
    for item in list(reversed(path.parents)) + [path]:
        try:
            info = checked_stat(item)
        except FileNotFoundError:
            if item == path and allow_missing_leaf:
                return
            raise ValueError("目标仅可新建最后一层技能目录，其父目录必须已存在") from None
        if not stat.S_ISDIR(info.st_mode):
            raise ValueError("目录路径中包含非目录对象")


def file_record(path: Path) -> dict:
    digest = hashlib.sha256()
    size = 0
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            size += len(chunk)
            digest.update(chunk)
    return {"sha256": digest.hexdigest(), "bytes": size}


def registered_entries(root: Path) -> dict:
    """校验根入口与专业模块；兼容旧版多入口，以便备份升级和原样回滚。"""
    entries = {"SKILL.md": SKILL_NAME}
    registry = root / "capabilities.json"
    if not os.path.lexists(registry):
        return entries  # 兼容仍只有一个入口的旧版副本。
    if not stat.S_ISREG(checked_stat(registry).st_mode):
        raise ValueError("能力登记表必须是普通文件")
    if registry.stat().st_size > 1024 * 1024:
        raise ValueError("能力登记表超过大小限制")
    with registry.open(encoding="utf-8") as stream:
        data = json.load(stream)
    if (not isinstance(data, dict) or type(data.get("schema_version")) is not int
            or data["schema_version"] not in (1, 2)):
        raise ValueError("能力登记表格式不合法")
    # v2 内部文件不再使用 SKILL.md，避免宿主递归发现后出现九个可选技能。
    collection, filename = ("modules", "MODULE.md") if data["schema_version"] == 2 else ("skills", "SKILL.md")
    if (not isinstance(data.get(collection), list)
            or (data["schema_version"] == 2 and "skills" in data)
            or (data["schema_version"] == 1 and "modules" in data)):
        raise ValueError("能力登记表格式不合法")
    names = set()
    for skill in data[collection]:
        if not isinstance(skill, dict):
            raise ValueError("专业模块登记项不合法")
        name, relative = skill.get("name"), skill.get("path")
        if (not isinstance(name, str) or name not in PROFESSIONAL_SKILLS
                or relative != f"skills/{name}/{filename}"):
            raise ValueError("专业模块名称或路径未获本版登记许可")
        if name in names or relative in entries:
            raise ValueError("专业模块登记重复")
        names.add(name)
        entries[relative] = name
    if names != PROFESSIONAL_SKILLS:
        raise ValueError("专业模块登记不完整，本版必须包含八个专业模块")
    return entries


def check_entry_name(path: Path, expected_name: str) -> None:
    with path.open(encoding="utf-8") as stream:
        prefix = stream.read(65536)
    match = re.match(r"\A---\r?\n(.*?)\r?\n---(?:\r?\n|\Z)", prefix, re.S)
    if not match:
        raise ValueError("Skill 入口缺少 frontmatter")
    names = re.findall(r"^name:\s*([^\r\n]+)", match.group(1), re.M)
    value = names[0].strip() if len(names) == 1 else ""
    if value not in (expected_name, '"' + expected_name + '"', "'" + expected_name + "'"):
        raise ValueError("Skill 入口 name 与登记不一致")


def pending_path(relative: str) -> str:
    return relative + ".pending"


def inventory(root: Path, entry_name: str = "SKILL.md", require_entry: bool = True) -> dict:
    check_path(root)
    if entry_name not in ("SKILL.md", PENDING_ENTRY):
        raise ValueError("未知的入口核验模式")
    entries = registered_entries(root)
    pending = entry_name == PENDING_ENTRY
    files, directories = {}, []

    def fail_on_walk_error(error):
        # 不可读目录不能被当成空目录，否则会把缺少参考资料的副本报告为完整。
        raise error

    for directory, dirs, names in os.walk(root, followlinks=False, onerror=fail_on_walk_error):
        seen = set()
        for name in sorted(dirs + names):
            path = Path(directory) / name
            relative = path.relative_to(root).as_posix()
            canonical = relative[:-8] if pending and name == PENDING_ENTRY else relative
            info = checked_stat(path)
            # Finder/资源管理器可自行生成这些普通文件；忽略、不复制、不删除，链接仍先拒绝。
            if stat.S_ISREG(info.st_mode) and is_os_metadata(name):
                continue
            validate_name(name)
            collision_key = unicodedata.normalize("NFC", name).casefold()
            if collision_key in seen:
                raise ValueError("包内有大小写或 Unicode 归一化后同名的文件")
            seen.add(collision_key)
            if getattr(info, "st_file_attributes", 0) & 0x2:
                raise ValueError("包内含 Windows 隐藏对象")
            if name.casefold() == "skill.md" and (pending or relative not in entries):
                raise ValueError("不允许未登记的嵌套 SKILL.md 或大小写变体")
            if (relative.startswith("skills/") and name.casefold() == "module.md"
                    and relative not in entries):
                raise ValueError("不允许未登记的内部 MODULE.md 或大小写变体")
            if name.casefold() == PENDING_ENTRY.casefold() and (not pending or canonical not in entries or name != PENDING_ENTRY):
                raise ValueError("包内含安装器保留文件名")
            if stat.S_ISDIR(info.st_mode):
                directories.append(canonical)
            elif stat.S_ISREG(info.st_mode):
                if canonical in entries:
                    check_entry_name(path, entries[canonical])
                files[canonical] = file_record(path)
            else:
                raise ValueError("包内只能有普通文件和目录")
    if require_entry and "SKILL.md" not in files:
        raise ValueError("缺少包根 SKILL.md")
    if require_entry and set(entries) - set(files):
        raise ValueError("缺少已登记的专业模块或 Skill 入口")
    return {"directories": sorted(directories), "files": dict(sorted(files.items()))}


def check_destination(skills_dir: Path, source: Path) -> Path:
    check_path(skills_dir, allow_missing_leaf=True)
    # 旧入口可能被宿主同时加载；连断链也保留，不能自动迁移或覆盖。
    if os.path.lexists(skills_dir / "weaver-department-assistant"):
        raise ValueError("指定技能根目录中存在旧名对象 weaver-department-assistant，拒绝双装；"
                         "请先经用户确认，将旧名对象备份并移出宿主技能扫描根目录，再安装新版；旧对象未修改")
    target = skills_dir / SKILL_NAME
    # 不在当前包、其祖先或客户 Git 项目中安装，也不建立嵌套副本。
    if target == source or target.is_relative_to(source) or source.is_relative_to(target):
        raise ValueError("目标与源技能目录重叠")
    for parent in [target] + list(target.parents):
        if os.path.lexists(parent / ".git"):
            raise ValueError("此助手仅支持用户级复制，拒绝安装到 Git 项目内")
    return target


def check_library(root: Path) -> dict:
    if not (root / "library").is_dir():
        raise ValueError("缺少完整资料库 library；不能只复制精选知识卡后启用助手")
    return verify_full_library(root / "library")


def verify_layout(root: Path, layout: str) -> dict:
    if layout == "full-library":
        return check_library(root)
    if (layout != "legacy-knowledge-only-v0.1.0" or os.path.lexists(root / "library")
            or os.path.lexists(root / "capabilities.json")):
        raise ValueError("历史恢复布局不符，不能跳过完整资料库核验")
    return {"status": layout, "checked_documents": 0,
            "boundary": "仅恢复已校验的 v0.1.0 旧版知识卡快照；旧版本来没有完整资料库，不代表新版完整安装。"}


def restorable_layout(root: Path) -> str:
    """只对旧目标或已校验备份识别历史布局；普通分发包仍强制完整资料库。"""
    verify_bundle(root / "knowledge")
    if os.path.lexists(root / "library"):
        check_library(root)
        return "full-library"
    with (root / "SKILL.md").open(encoding="utf-8") as stream:
        prefix = stream.read(65536)
    frontmatter = re.match(r"\A---\r?\n(.*?)\r?\n---(?:\r?\n|\Z)", prefix, re.S)
    versions = re.findall(r"^\s+version:\s*([^\r\n]+)", frontmatter[1], re.M) if frontmatter else []
    if (versions not in (["0.1.0"], ['"0.1.0"'], ["'0.1.0'"])
            or os.path.lexists(root / "capabilities.json")):
        raise ValueError("旧目标缺少完整资料库，且不是可恢复的 v0.1.0 历史单入口布局")
    return "legacy-knowledge-only-v0.1.0"


def copy_to_stage(source: Path, stage: Path, expected: dict, layout: str = "full-library") -> None:
    entries = {relative for relative in expected["files"] if Path(relative).name == "SKILL.md"}
    for relative in expected["directories"]:
        (stage / relative).mkdir()
    for relative in expected["files"]:
        destination = stage / (pending_path(relative) if relative in entries else relative)
        source_file = source / relative
        if not stat.S_ISREG(checked_stat(source_file).st_mode):
            raise ValueError("复制过程中来源类型变化")
        with source_file.open("rb") as incoming, destination.open("xb") as outgoing:
            for chunk in iter(lambda: incoming.read(1024 * 1024), b""):
                outgoing.write(chunk)
    if inventory(stage, entry_name=PENDING_ENTRY) != expected or inventory(source) != expected:
        raise ValueError("复制过程中来源发生变化，未启用技能")
    verify_bundle(stage / "knowledge")
    verify_layout(stage, layout)


def publish_stage(stage: Path, target: Path, expected: dict, layout: str = "full-library") -> None:
    # mkdir 独占目标；新布局只启用根入口，旧布局回滚时仍按根入口最后发布。
    entries = {relative for relative in expected["files"] if Path(relative).name == "SKILL.md"}
    target.mkdir()
    for relative in expected["directories"]:
        (target / relative).mkdir()
    for relative in expected["files"]:
        if relative in entries:
            continue
        os.link(stage / relative, target / relative)
        (stage / relative).unlink()
    actual = inventory(target, require_entry=False)
    without_entry = {"directories": expected["directories"],
                     "files": {key: value for key, value in expected["files"].items() if key not in entries}}
    if actual != without_entry or any(file_record(stage / pending_path(relative)) != expected["files"][relative]
                                      for relative in entries):
        raise ValueError("目标逐字节校验失败，未启用技能")
    verify_bundle(target / "knowledge")
    verify_layout(target, layout)
    activated = []
    try:
        for relative in sorted(entries - {"SKILL.md"}) + ["SKILL.md"]:
            os.link(stage / pending_path(relative), target / relative)
            activated.append(relative)
    except BaseException:
        # 仅撤回本次创建且仍与暂存相同的入口；不删除接收方并发替换的文件。
        rollback_failed = []
        for relative in reversed(activated):
            destination = target / relative
            try:
                if (stat.S_ISREG(checked_stat(destination).st_mode)
                        and os.path.samefile(stage / pending_path(relative), destination)):
                    destination.unlink()
                else:
                    rollback_failed.append(relative)
            except (OSError, ValueError):
                rollback_failed.append(relative)
        # 冲突路径可能是接收方并发创建的入口；保留它，但不能把目标报告成完全未启用。
        rollback_failed.extend(relative for relative in entries
                               if os.path.lexists(target / relative) and relative not in rollback_failed)
        if rollback_failed:
            raise ValueError("入口回撤未完成，须停用并核对本次目标：" + ", ".join(rollback_failed)) from None
        raise


def cleanup_stage(stage: Path, expected: dict) -> None:
    for relative in expected["files"]:
        if Path(relative).name == "SKILL.md":
            (stage / pending_path(relative)).unlink()
    for relative in sorted(expected["directories"], key=lambda value: (value.count("/"), value), reverse=True):
        (stage / relative).rmdir()
    stage.rmdir()


def replace_installed(host: str, skills_dir: Path, source: Path, expected: dict, current: dict,
                      parent: Path, result: dict, action: str, source_baseline: dict | None,
                      source_layout: str, current_layout: str) -> dict:
    """先完整暂存，旧目录移出扫描根后才启用新版；失败不删除任何一版内容。"""
    target = skills_dir / SKILL_NAME
    check_backup_parent(parent, skills_dir, SOURCE_ROOT)
    if not parent.exists():
        parent.mkdir(mode=0o700)
    folder = Path(tempfile.mkdtemp(prefix="cc-" + action + "-", dir=parent))
    stage = folder / "staging"
    stage.mkdir()
    old = folder / "package"
    receipt = None
    moved = False
    try:
        if source_layout == "full-library":
            copy_to_stage(source, stage, expected)
        else:
            copy_to_stage(source, stage, expected, layout=source_layout)
        check_destination(skills_dir, SOURCE_ROOT)
        if inventory(target) != current:
            raise ValueError("暂存期间目标发生变化，原目标未替换")
        receipt = backup_record(folder, host, skills_dir, current, current_layout)
        target.rename(old)
        moved = True
        if inventory(old) != current:
            raise ValueError("移出后的旧版与备份清单不符，停止升级")
        if source_layout == "full-library":
            publish_stage(stage, target, expected)
        else:
            publish_stage(stage, target, expected, layout=source_layout)
        if inventory(target) != expected:
            raise ValueError("启用后的目标与新包不符")
    except (OSError, ValueError, UnicodeError, sqlite3.Error) as exc:
        detail = str(exc) if isinstance(exc, ValueError) else type(exc).__name__
        restored = not moved
        if moved:
            try:
                # 并发写入或半成品全部保存在扫描根外，不覆盖、不清空它们。
                if os.path.lexists(target):
                    target.rename(folder / "failed-new-package")
                old.rename(target)
                restored = inventory(target) == current
            except (OSError, ValueError, UnicodeError):
                restored = False
        return {**result, "status": action + ("-failed-restored" if restored else "-recovery-required"),
                "writes": True, "backup": str(folder), "error": detail,
                "previous_restored": restored,
                "recovery": "保留本次暂存和失败内容；只核对本次目标与备份。若未恢复，不继续运行该助手，不手工补入口。"}
    try:
        # 回滚保留旧版受管基线；不能把用户自建文件洗成下一次可覆盖的发布文件。
        save_baseline(skills_dir, target, source_baseline)
        cleanup_stage(stage, expected)
        status = "upgraded" if action == "upgrade" else "rolled-back"
    except (OSError, ValueError, UnicodeError) as exc:
        status = action + "-completed-maintenance-pending"
        result = {**result, "maintenance_error": str(exc) if isinstance(exc, ValueError) else type(exc).__name__}
    return {**result, "status": status, "writes": True, "backup": str(folder),
            "rollback_record": str(receipt), "restored_content": "verified-file-content" if action == "rollback" else None,
            "local_changes": "旧目录整体保存在备份中；用户修改和未知文件没有自动合并进当前包。",
            "next": "新开对话验证实际加载和资料读取。备份保留，不自动删除。"}


def run(host: str, skills_dir: Path, install: bool = False, upgrade: bool = False,
        backup_dir: Path | None = None, accept_local_changes_backup: bool = False,
        rollback: Path | None = None) -> dict:
    if host not in HOSTS:
        raise ValueError("未知宿主")
    if upgrade and rollback is not None:
        raise ValueError("升级与回滚不能同时请求")
    if accept_local_changes_backup and not (upgrade or rollback is not None):
        raise ValueError("保留本地改动到备份的确认仅用于升级或回滚")
    if backup_dir is not None and not (upgrade or rollback is not None):
        raise ValueError("备份目录参数仅用于升级或回滚")
    source = SOURCE_ROOT
    target = check_destination(skills_dir, source)
    state_root, _ = state_paths(skills_dir)  # 在任何写入前确认状态目录不会落进技能扫描根。
    if rollback is not None:
        source, expected, source_baseline, source_layout = load_backup(rollback, host, skills_dir)
    else:
        expected = inventory(source)
        source_baseline = expected
        source_layout = "full-library"
    knowledge = verify_bundle(source / "knowledge")
    library = verify_layout(source, source_layout)
    # 内部仍逐文件核对；对外只给摘要，避免完整库数万条记录淹没安装结果。
    inventory_hash = inventory_digest(expected)
    result = {"host": host, "target": str(target), "file_count": len(expected["files"]),
              "local_state_directory": str(state_root), "staging_parent": str(skills_dir.parent),
              "total_bytes": sum(value["bytes"] for value in expected["files"].values()),
              "inventory_sha256": inventory_hash,
              "inventory_scope": "all-files-sha256-and-size-checked; summary-output-only",
              "professional_skill_count": len(registered_entries(source)) - 1,
              "professional_module_count": len(registered_entries(source)) - 1,
              "discoverable_skill_count": sum(Path(relative).name == "SKILL.md"
                                               for relative in registered_entries(source)),
              "manifest_paths": {"full_library": "library/manifest.json" if source_layout == "full-library" else None,
                                 "knowledge_cards": "knowledge/manifest.json"},
              "source_layout": source_layout,
              "knowledge_cards": knowledge, "full_library": library, "boundary": BOUNDARY}
    if os.path.lexists(target):
        current = inventory(target)
        if current == expected:
            verify_layout(target, source_layout)
            return {**result, "status": "already-present", "writes": False}
        if not upgrade and rollback is None:
            raise ValueError("目标已存在且内容不同，拒绝覆盖；原目标未修改。更新请先用 --upgrade 预览")
        # 替换前确认旧版可恢复，避免升级成功后才发现备份布局无法回滚。
        current_layout = restorable_layout(target)
        previous = baseline(skills_dir, target)
        local = differences(current, previous)
        state_root, _ = state_paths(skills_dir)
        parent = backup_dir if backup_dir is not None else state_root
        check_backup_parent(parent, skills_dir, SOURCE_ROOT)
        action = "rollback" if rollback is not None else "upgrade"
        result.update(action=action, backup_parent=str(parent), staging_parent=str(parent), backup_layout=current_layout,
                      local_change_counts={key: len(value) for key, value in local.items() if isinstance(value, list)},
                      local_change_examples={key: value[:20] for key, value in local.items() if isinstance(value, list)},
                      baseline=local["baseline"], requires_backup_acceptance=local["requires_backup_acceptance"],
                      local_changes_policy="旧目录完整保留在扫描根外；本地修改和未知文件仅在备份，不自动并入新版。")
        if not install:
            return {**result, "status": action + "-preview", "writes": False,
                    "next": "确认备份位置与变化后加 --install；无基线或有本地改动时，还需明确接受 --accept-local-changes-backup。"}
        if local["requires_backup_acceptance"] and not accept_local_changes_backup:
            raise ValueError("旧版无基线或存在本地改动；请确认这些内容仅保存在备份、不并入新版后，显式加 --accept-local-changes-backup")
        return replace_installed(host, skills_dir, source, expected, current, parent, result, action,
                                 source_baseline, source_layout, current_layout)
    if upgrade:
        raise ValueError("目标不存在，不能升级；首次使用请按安装流程预览")
    if not install:
        return {**result, "status": "rollback-preview" if rollback is not None else "preview", "writes": False,
                "next": "核实该宿主的技能根目录后，用同样参数加 --install；不自动判断目录是否会被宿主识别。"}

    stage = Path(tempfile.mkdtemp(prefix=".weaver-skill-staging-", dir=skills_dir.parent))
    activated = False
    try:
        if source_layout == "full-library":
            copy_to_stage(source, stage, expected)
        else:
            copy_to_stage(source, stage, expected, layout=source_layout)
        check_destination(skills_dir, source)
        if not skills_dir.exists():
            skills_dir.mkdir()
        check_path(skills_dir)
        if source_layout == "full-library":
            publish_stage(stage, target, expected)
        else:
            publish_stage(stage, target, expected, layout=source_layout)
        activated = True
        save_baseline(skills_dir, target, source_baseline)
        cleanup_stage(stage, expected)
        return {**result, "status": "rolled-back" if rollback is not None else "installed", "writes": True,
                "source_backup": str(rollback) if rollback is not None else None}
    except (OSError, ValueError, UnicodeError, sqlite3.Error) as exc:
        detail = str(exc) if isinstance(exc, ValueError) else type(exc).__name__
        rollback_pending = "入口回撤未完成" in detail
        return {**result, "status": "installed-cleanup-pending" if activated else (
                    "activation-rollback-pending" if rollback_pending else "incomplete-not-activated"),
                "writes": True, "staging": str(stage), "error": detail,
                "recovery": "未覆盖已有目标。保留暂存及本次新建内容以便检查；未完成时不要手工补 SKILL.md。复制需同卷硬链接。强杀或断电后须检查全部入口，不能承诺多文件激活原子性。"}


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", choices=HOSTS, required=True)
    parser.add_argument("--skills-dir", type=Path, required=True, help="接收方核实的宿主技能根目录，必须为绝对路径")
    parser.add_argument("--install", action="store_true", help="显式执行复制；省略时只预览")
    parser.add_argument("--upgrade", action="store_true", help="预览已有安装的备份升级；配合 --install 才执行")
    parser.add_argument("--backup-dir", type=Path, help="可选；扫描根外的同卷备份父目录，默认使用本地状态目录")
    parser.add_argument("--accept-local-changes-backup", action="store_true", help="明确接受用户改动只留在完整备份、不自动合入新版")
    parser.add_argument("--rollback", type=Path, help="预览恢复指定 restore.json；配合 --install 才执行，并保留当前版本")
    args = parser.parse_args()
    try:
        result = run(args.host, args.skills_dir, args.install, args.upgrade, args.backup_dir,
                     args.accept_local_changes_backup, args.rollback)
    except (OSError, ValueError, UnicodeError, sqlite3.Error) as exc:
        detail = str(exc) if isinstance(exc, ValueError) else type(exc).__name__
        result = {"status": "refused", "error": detail, "boundary": BOUNDARY}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    failed = result["status"] in {"refused", "incomplete-not-activated", "activation-rollback-pending"}
    return 1 if failed or "-failed-" in result["status"] or "-recovery-required" in result["status"] else 0


if __name__ == "__main__":
    raise SystemExit(main())

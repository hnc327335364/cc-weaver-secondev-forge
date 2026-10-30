"""只使用隔离临时目录，不触及实际宿主安装或配置。"""

import importlib.util
import hashlib
import json
import os
from pathlib import Path
import shutil
import sqlite3
import stat
import subprocess
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest import mock

sys.dont_write_bytecode = True
PACKAGE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PACKAGE / "scripts"))
spec = importlib.util.spec_from_file_location("install_local", PACKAGE / "scripts/install_local.py")
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)


class InstallLocalTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="skill-copy-test-")
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name).resolve()
        self.source = self.root / "中文 空格来源" / installer.SKILL_NAME
        # 基础回归使用单入口旧版夹具；专业入口另建受控小夹具，避免复制完整工具和资料库。
        def omit_real_library(directory, names):
            return {"library", "tools", "skills", "capabilities.json"} if Path(directory) == PACKAGE else set()

        shutil.copytree(PACKAGE, self.source, ignore=omit_real_library)
        self.make_library(self.source / "library")
        self.destination = self.root / "接收方 中文 空格" / "skills"
        self.destination.parent.mkdir()
        self.target = self.destination / installer.SKILL_NAME
        patcher = mock.patch.object(installer, "SOURCE_ROOT", self.source)
        patcher.start()
        self.addCleanup(patcher.stop)

    def make_library(self, root):
        root.mkdir()
        body = "# E9 随包完整正文测试\nWfForm.registerCheckEvent\n".encode("utf-8")
        checksum = hashlib.sha256(body).hexdigest()
        relative = f"objects/{checksum[:2]}/{checksum}.txt"
        object_path = root / relative
        object_path.parent.mkdir(parents=True)
        object_path.write_bytes(body)
        (root / "pages").mkdir()
        (root / "pages/doc-fixture.md").write_bytes(body)
        record = {"id": "doc-fixture", "source_id": "fixture", "source_path": "测试来源/表单.md",
                  "source_version": "fixture-v1", "title": "表单", "platform": "E9", "kind": "text",
                  "media_type": "text/markdown", "object_path": relative, "source_sha256": checksum,
                  "output_sha256": checksum, "source_bytes": len(body), "output_bytes": len(body),
                  "encoding": "utf-8", "line_count": 2}
        with sqlite3.connect(root / "catalog.sqlite") as db:
            db.execute("CREATE TABLE sources(id TEXT PRIMARY KEY,label TEXT,version TEXT,root_path TEXT)")
            db.execute("INSERT INTO sources VALUES('fixture','隔离测试来源','fixture-v1','测试来源')")
            db.execute("CREATE TABLE documents(id TEXT PRIMARY KEY,source_id TEXT,source_path TEXT,"
                       "source_version TEXT,title TEXT,platform TEXT,kind TEXT,media_type TEXT,object_path TEXT,"
                       "source_sha256 TEXT,output_sha256 TEXT,source_bytes INTEGER,output_bytes INTEGER,"
                       "encoding TEXT,line_count INTEGER,text TEXT,safety_changes TEXT)")
            db.execute("INSERT INTO documents VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                       [*record.values(), body.decode("utf-8"), "[]"])
        record.update(page_path="pages/doc-fixture.md", page_sha256=checksum)
        manifest = {"schema_version": 1,
                    "catalog_sha256": hashlib.sha256((root / "catalog.sqlite").read_bytes()).hexdigest(),
                    "files": [record], "summary": {"source_records": 1, "text_records": 1,
                      "attachment_records": 0, "unique_objects": 1, "source_bytes": len(body), "output_bytes": len(body)}}
        (root / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False), encoding="utf-8")
        self.library_object_relative = relative

    def run_install(self, host="codex", install=True):
        return installer.run(host, self.destination, install)

    def make_professional_skills(self):
        skills = []
        for name in sorted(installer.PROFESSIONAL_SKILLS):
            relative = f"skills/{name}/SKILL.md"
            path = self.source / relative
            path.parent.mkdir(parents=True)
            path.write_text(f"---\nname: {name}\ndescription: 隔离测试入口\n---\n# 测试\n", encoding="utf-8")
            skills.append({"name": name, "path": relative})
        registry = {"schema_version": 1, "skills": skills}
        (self.source / "capabilities.json").write_text(json.dumps(registry), encoding="utf-8")
        return registry

    def make_professional_modules(self):
        registry = self.make_professional_skills()
        for item in registry["skills"]:
            previous = self.source / item["path"]
            item["path"] = item["path"].replace("/SKILL.md", "/MODULE.md")
            previous.rename(self.source / item["path"])
        registry["schema_version"] = 2
        registry["modules"] = registry.pop("skills")
        (self.source / "capabilities.json").write_text(json.dumps(registry), encoding="utf-8")
        return registry

    def test_single_skill_modules_install_complete_and_idempotent_on_each_host(self):
        self.make_professional_modules()
        expected = installer.inventory(self.source)
        for host in installer.HOSTS:
            with self.subTest(host=host):
                destination = self.destination.parent / host
                preview = installer.run(host, destination, False)
                self.assertEqual(preview["professional_module_count"], 8)
                self.assertEqual(preview["discoverable_skill_count"], 1)
                self.assertFalse(destination.exists())
                result = installer.run(host, destination, True)
                target = destination / installer.SKILL_NAME
                self.assertEqual(result["status"], "installed")
                self.assertEqual(installer.inventory(target), expected)
                self.assertEqual(list(target.rglob("SKILL.md")), [target / "SKILL.md"])
                self.assertEqual(len(list((target / "skills").rglob("MODULE.md"))), 8)
                self.assertEqual(installer.run(host, destination, True)["status"], "already-present")

    def test_single_skill_module_registry_rejects_mixed_layout_and_missing_modules(self):
        registry = self.make_professional_modules()
        registry_path = self.source / "capabilities.json"
        cases = []
        for mutate in (
                lambda value: value.update(skills=[]),
                lambda value: value["modules"][0].update(path="skills/weaver-cc-knowledge/SKILL.md"),
                lambda value: value["modules"].pop(),
                lambda value: value["modules"].append(value["modules"][0])):
            value = json.loads(json.dumps(registry))
            mutate(value)
            cases.append(value)
        for value in cases:
            with self.subTest(value=value):
                registry_path.write_text(json.dumps(value), encoding="utf-8")
                with self.assertRaises(ValueError):
                    self.run_install()
                self.assertFalse(self.destination.exists())
        registry_path.write_text(json.dumps(registry), encoding="utf-8")
        module = self.source / registry["modules"][0]["path"]
        body = module.read_bytes()
        module.unlink()
        with self.assertRaisesRegex(ValueError, "缺少已登记"):
            self.run_install()
        module.write_bytes(body)
        module.write_text("---\nname: other\ndescription: wrong\n---\n", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "name 与登记不一致"):
            self.run_install()
        self.assertFalse(self.destination.exists())

    def test_single_skill_rejects_extra_discoverable_entry_or_missing_registry(self):
        self.make_professional_modules()
        extra = self.source / "skills/weaver-cc-knowledge/SKILL.md"
        extra.write_text("---\nname: weaver-cc-knowledge\ndescription: duplicate\n---\n", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "未登记的嵌套"):
            self.run_install()
        extra.unlink()
        (self.source / "capabilities.json").unlink()
        with self.assertRaisesRegex(ValueError, "未登记的内部"):
            self.run_install()
        self.assertFalse(self.destination.exists())

    def test_single_root_activates_only_after_all_modules_are_validated(self):
        self.make_professional_modules()
        original_link = os.link
        entries = []

        def check_root_activation(source, target):
            if target.name == "SKILL.md":
                self.assertEqual(len(list((self.target / "skills").rglob("MODULE.md"))), 8)
                self.assertEqual(list(self.target.rglob("SKILL.md")), [])
                entries.append(target)
            return original_link(source, target)

        with mock.patch.object(installer.os, "link", side_effect=check_root_activation):
            self.assertEqual(self.run_install()["status"], "installed")
        self.assertEqual(entries, [self.target / "SKILL.md"])

    def test_registered_professional_skills_install_with_one_root_and_shared_library(self):
        self.make_professional_skills()
        before = installer.inventory(self.source)
        preview = self.run_install(install=False)
        self.assertEqual(preview["professional_skill_count"], 8)
        self.assertFalse(self.destination.exists())
        result = self.run_install()
        self.assertEqual(result["status"], "installed")
        self.assertEqual(installer.inventory(self.target), before)
        self.assertEqual(len(list(self.target.rglob("SKILL.md"))), 9)
        self.assertEqual(len(list(self.target.rglob("catalog.sqlite"))), 1)
        self.assertEqual(self.run_install()["status"], "already-present")

    def test_professional_registry_rejects_invalid_paths_names_duplicates_and_missing_entries(self):
        registry = self.make_professional_skills()
        registry_path = self.source / "capabilities.json"
        bad_cases = []
        for key, value in (("path", "../SKILL.md"), ("path", "/tmp/SKILL.md"),
                           ("path", "skills\\weaver-cc-knowledge\\SKILL.md"),
                           ("name", "arbitrary-skill")):
            item = json.loads(json.dumps(registry))
            item["skills"][0][key] = value
            bad_cases.append(item)
        bad_cases.extend([{"schema_version": 1, "skills": registry["skills"][:-1]},
                          {"schema_version": 1, "skills": registry["skills"] + [registry["skills"][0]]},
                          {"schema_version": True, "skills": registry["skills"]}])
        for data in bad_cases:
            with self.subTest(data=data):
                registry_path.write_text(json.dumps(data), encoding="utf-8")
                with self.assertRaises(ValueError):
                    self.run_install()
                self.assertFalse(self.destination.exists())
        registry_path.write_text(json.dumps(registry), encoding="utf-8")
        (self.source / registry["skills"][0]["path"]).unlink()
        with self.assertRaisesRegex(ValueError, "缺少已登记"):
            self.run_install()
        self.assertFalse(self.destination.exists())

    def test_professional_skill_name_must_match_registry(self):
        registry = self.make_professional_skills()
        entry = self.source / registry["skills"][0]["path"]
        entry.write_text("---\nname: other\ndescription: wrong\n---\n", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "name 与登记不一致"):
            self.run_install()
        self.assertFalse(self.destination.exists())

    def test_all_entries_are_pending_until_data_validated_and_root_is_last(self):
        self.make_professional_skills()
        original_check = installer.check_library
        original_link = os.link
        entries = []

        def check_without_entries(root):
            if root != self.source:
                self.assertEqual(list(root.rglob("SKILL.md")), [])
            return original_check(root)

        def record_activation(source, target):
            if target.name == "SKILL.md":
                entries.append(target.relative_to(self.target).as_posix())
                self.assertTrue((self.target / "library/catalog.sqlite").is_file())
            return original_link(source, target)

        with mock.patch.object(installer, "check_library", side_effect=check_without_entries), \
                mock.patch.object(installer.os, "link", side_effect=record_activation):
            result = self.run_install()
        self.assertEqual(result["status"], "installed")
        self.assertEqual(len(entries), 9)
        self.assertEqual(entries[-1], "SKILL.md")

    def test_partial_professional_activation_failure_rolls_back_only_created_entries(self):
        self.make_professional_skills()
        original_link = os.link
        count = 0

        def fail_third_entry(source, target):
            nonlocal count
            if target.name == "SKILL.md":
                count += 1
                if count == 3:
                    raise OSError("simulated activation failure")
            return original_link(source, target)

        with mock.patch.object(installer.os, "link", side_effect=fail_third_entry):
            result = self.run_install()
        self.assertEqual(result["status"], "incomplete-not-activated")
        self.assertEqual(list(self.target.rglob("SKILL.md")), [])
        stage = Path(result["staging"])
        self.assertEqual(list(stage.rglob("SKILL.md")), [])
        self.assertEqual(len(list(stage.rglob(installer.PENDING_ENTRY))), 9)

    def test_failed_entry_rollback_is_reported_not_claimed_inactive(self):
        self.make_professional_skills()
        original_link = os.link
        original_unlink = Path.unlink
        count = 0

        def fail_second_entry(source, target):
            nonlocal count
            if target.name == "SKILL.md":
                count += 1
                if count == 2:
                    raise OSError("simulated activation failure")
            return original_link(source, target)

        def refuse_entry_unlink(path, *args, **kwargs):
            if path.name == "SKILL.md" and path.is_relative_to(self.target):
                raise PermissionError("simulated rollback failure")
            return original_unlink(path, *args, **kwargs)

        with mock.patch.object(installer.os, "link", side_effect=fail_second_entry), \
                mock.patch.object(Path, "unlink", refuse_entry_unlink):
            result = self.run_install()
        self.assertEqual(result["status"], "activation-rollback-pending")
        self.assertIn("入口回撤未完成", result["error"])
        self.assertFalse((self.target / "SKILL.md").exists())
        self.assertEqual(len(list(self.target.rglob("SKILL.md"))), 1)

    def test_concurrent_professional_entry_is_preserved_and_reported_for_review(self):
        self.make_professional_skills()
        original_link = os.link
        concurrent_entry = None

        def concurrent_entry_before_link(source, target):
            nonlocal concurrent_entry
            if target.name == "SKILL.md" and concurrent_entry is None:
                concurrent_entry = target
                target.write_text("receiver concurrent content", encoding="utf-8")
            return original_link(source, target)

        with mock.patch.object(installer.os, "link", side_effect=concurrent_entry_before_link):
            result = self.run_install()
        self.assertEqual(result["status"], "activation-rollback-pending")
        self.assertEqual(concurrent_entry.read_text(encoding="utf-8"), "receiver concurrent content")
        self.assertFalse((self.target / "SKILL.md").exists())

    def test_preview_all_three_hosts_does_not_write(self):
        before = sorted(path.relative_to(self.root).as_posix() for path in self.root.rglob("*"))
        for host in installer.HOSTS:
            with self.subTest(host=host):
                result = self.run_install(host, install=False)
                self.assertEqual(result["status"], "preview")
                self.assertFalse(result["writes"])
                self.assertGreater(result["file_count"], 10)
                self.assertNotIn("files", result)
                self.assertEqual(result["full_library"]["checked_documents"], 1)
                self.assertEqual(result["full_library"]["checked_readable_pages"], 1)
                self.assertEqual(result["manifest_paths"]["full_library"], "library/manifest.json")
                self.assertEqual(len(result["inventory_sha256"]), 64)
                self.assertLess(len(json.dumps(result, ensure_ascii=False)), 6000)
        self.assertEqual(before, sorted(path.relative_to(self.root).as_posix() for path in self.root.rglob("*")))

    def test_each_host_installs_complete_copy_and_is_idempotent(self):
        for host in installer.HOSTS:
            with self.subTest(host=host):
                destination = self.destination.parent / host
                result = installer.run(host, destination, True)
                self.assertEqual(result["status"], "installed")
                self.assertEqual(installer.inventory(self.source), installer.inventory(destination / installer.SKILL_NAME))
                self.assertEqual(installer.run(host, destination, True)["status"], "already-present")
        self.assertEqual(list(self.destination.parent.glob(".weaver-skill-staging-*")), [])

    def test_skill_name_is_cc_identity(self):
        self.assertEqual(installer.SKILL_NAME, "weaver-cc-assistant")

    def test_old_named_directory_or_file_refuses_preview_and_install_without_writes(self):
        self.destination.mkdir()
        old = self.destination / "weaver-department-assistant"
        for kind in ("directory", "file"):
            with self.subTest(kind=kind):
                if kind == "directory":
                    old.mkdir()
                    (old / "keep.txt").write_text("old user content", encoding="utf-8")
                else:
                    old.write_text("old user content", encoding="utf-8")
                before = sorted(path.relative_to(self.root).as_posix() for path in self.root.rglob("*"))
                for install in (False, True):
                    with self.subTest(install=install), self.assertRaisesRegex(ValueError, "拒绝双装.*用户确认.*移出"):
                        self.run_install(install=install)
                self.assertEqual(before, sorted(path.relative_to(self.root).as_posix() for path in self.root.rglob("*")))
                content = old / "keep.txt" if kind == "directory" else old
                self.assertEqual(content.read_text(encoding="utf-8"), "old user content")
                self.assertFalse(self.target.exists())
                content.unlink()
                if kind == "directory":
                    old.rmdir()

    def test_old_named_symlink_and_dangling_link_refuse_without_following_or_changes(self):
        self.destination.mkdir()
        old = self.destination / "weaver-department-assistant"
        before_source = installer.inventory(self.source)
        for link_target in (self.source, self.root / "missing-old-source"):
            with self.subTest(link_target=link_target):
                try:
                    old.symlink_to(link_target, target_is_directory=True)
                except (OSError, NotImplementedError):
                    self.skipTest("当前测试环境不能创建符号链接")
                for install in (False, True):
                    with self.subTest(install=install), self.assertRaisesRegex(ValueError, "拒绝双装"):
                        self.run_install(install=install)
                self.assertTrue(old.is_symlink())
                self.assertEqual(os.readlink(old), str(link_target))
                self.assertEqual(installer.inventory(self.source), before_source)
                self.assertFalse(self.target.exists())
                self.assertFalse(list(self.destination.parent.glob(".weaver-skill-staging-*")))
                old.unlink()

    def test_old_and_identical_new_installations_refuse_before_already_present(self):
        self.run_install()
        old = self.destination / "weaver-department-assistant"
        old.mkdir()
        (old / "keep.txt").write_text("old installation", encoding="utf-8")
        before = installer.inventory(self.target)
        for install in (False, True):
            with self.subTest(install=install), self.assertRaisesRegex(ValueError, "拒绝双装"):
                self.run_install(install=install)
        self.assertEqual(installer.inventory(self.target), before)
        self.assertEqual((old / "keep.txt").read_text(encoding="utf-8"), "old installation")
        self.assertFalse(list(self.destination.parent.glob(".weaver-skill-staging-*")))

    def test_old_moved_outside_requested_root_allows_new_install_and_idempotence(self):
        self.destination.mkdir()
        old = self.destination / "weaver-department-assistant"
        old.mkdir()
        (old / "keep.txt").write_text("user backup", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "拒绝双装"):
            self.run_install()
        # 模拟用户另行确认后移出；安装器自身不能执行迁移，也不扫描未指定的根。
        backup = self.root / "user-confirmed-backup" / old.name
        backup.parent.mkdir()
        old.rename(backup)
        self.assertEqual(self.run_install(install=False)["status"], "preview")
        self.assertEqual(self.run_install()["status"], "installed")
        self.assertEqual(self.run_install()["status"], "already-present")
        self.assertEqual((backup / "keep.txt").read_text(encoding="utf-8"), "user backup")
        self.assertEqual(installer.inventory(self.target), installer.inventory(self.source))

    def test_old_name_appearing_after_copy_refuses_activation(self):
        original = installer.copy_to_stage
        old = self.destination / "weaver-department-assistant"

        def concurrent_old(source, stage, expected):
            original(source, stage, expected)
            old.mkdir(parents=True)
            (old / "keep.txt").write_text("concurrent old installation", encoding="utf-8")

        with mock.patch.object(installer, "copy_to_stage", side_effect=concurrent_old):
            result = self.run_install()
        self.assertEqual(result["status"], "incomplete-not-activated")
        self.assertIn("拒绝双装", result["error"])
        self.assertFalse(self.target.exists())
        self.assertEqual((old / "keep.txt").read_text(encoding="utf-8"), "concurrent old installation")
        self.assertTrue((Path(result["staging"]) / installer.PENDING_ENTRY).exists())

    def test_existing_different_target_preserved(self):
        self.run_install()
        existing = self.target / "README.md"
        existing.write_text("接收方已经修改，不得覆盖", encoding="utf-8")
        before = installer.inventory(self.target)
        with self.assertRaisesRegex(ValueError, "拒绝覆盖"):
            self.run_install()
        self.assertEqual(before, installer.inventory(self.target))

    def test_extra_target_file_conflicts(self):
        self.run_install()
        (self.target / "local-note.txt").write_text("keep", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "拒绝覆盖"):
            self.run_install()
        self.assertTrue((self.target / "local-note.txt").exists())

    def test_empty_existing_target_is_not_replaced(self):
        self.target.mkdir(parents=True)
        with self.assertRaisesRegex(ValueError, "缺少"):
            self.run_install()
        self.assertEqual(list(self.target.iterdir()), [])

    def test_bad_knowledge_hash_refuses_before_write(self):
        manifest = json.loads((self.source / "knowledge/manifest.json").read_text(encoding="utf-8"))
        note = self.source / "knowledge" / manifest["entries"][0]["file"]
        note.write_text("modified", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "变更"):
            self.run_install()
        self.assertFalse(self.destination.exists())

    def test_missing_full_library_refuses_preview_and_install(self):
        (self.source / "library").rename(self.root / "library-not-shipped")
        for install in (False, True):
            with self.subTest(install=install), self.assertRaisesRegex(ValueError, "缺少完整资料库"):
                self.run_install(install=install)
        self.assertFalse(self.destination.exists())
        self.assertTrue((self.source / "knowledge/manifest.json").exists())
        self.assertFalse(list(self.destination.parent.glob(".weaver-skill-staging-*")))

    def test_changed_full_library_object_refuses_before_write(self):
        (self.source / "library" / self.library_object_relative).write_text("changed", encoding="utf-8")
        for install in (False, True):
            with self.subTest(install=install), self.assertRaisesRegex(ValueError, "已改变"):
                self.run_install(install=install)
        self.assertFalse(self.destination.exists())

    def test_changed_readable_page_refuses_before_write(self):
        (self.source / "library/pages/doc-fixture.md").write_text("changed", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "正文页哈希"):
            self.run_install()
        self.assertFalse(self.destination.exists())

    def test_library_verified_at_source_stage_and_before_entry_activation(self):
        original = installer.check_library
        checked = []

        def record_check(root):
            checked.append(root)
            if root != self.source:
                self.assertFalse((root / "SKILL.md").exists())
            return original(root)

        with mock.patch.object(installer, "check_library", side_effect=record_check):
            result = self.run_install()
        self.assertEqual(result["status"], "installed")
        self.assertEqual(len(checked), 3)
        self.assertEqual(checked[0], self.source)
        self.assertTrue(checked[1].name.startswith(".weaver-skill-staging-"))
        self.assertEqual(checked[2], self.target)
        self.assertTrue((self.target / "library" / self.library_object_relative).exists())

    def test_lost_library_after_staging_never_activates(self):
        original = installer.copy_to_stage

        def lose_catalog(source, stage, expected):
            original(source, stage, expected)
            (stage / "library/catalog.sqlite").rename(self.root / "removed-staged-catalog.sqlite")

        with mock.patch.object(installer, "copy_to_stage", side_effect=lose_catalog):
            result = self.run_install()
        self.assertEqual(result["status"], "incomplete-not-activated")
        self.assertFalse((self.target / "SKILL.md").exists())
        self.assertTrue((Path(result["staging"]) / installer.PENDING_ENTRY).exists())

    def test_corrupted_library_during_publish_never_activates(self):
        original_link = os.link

        def corrupt_object(source, target):
            original_link(source, target)
            if target == self.target / "library" / self.library_object_relative:
                target.write_bytes(b"corrupted during publish")

        with mock.patch.object(installer.os, "link", side_effect=corrupt_object):
            result = self.run_install()
        self.assertEqual(result["status"], "incomplete-not-activated")
        self.assertFalse((self.target / "SKILL.md").exists())

    def test_cli_missing_library_refuses_without_traceback(self):
        (self.source / "library").rename(self.root / "library-not-shipped")
        result = subprocess.run([sys.executable, str(self.source / "scripts/install_local.py"),
                                 "--host", "codex", "--skills-dir", str(self.destination), "--install"],
                                capture_output=True, encoding="utf-8")
        self.assertEqual(result.returncode, 1)
        self.assertEqual(json.loads(result.stdout)["status"], "refused")
        self.assertIn("缺少完整资料库", result.stdout)
        self.assertEqual(result.stderr, "")
        self.assertFalse(self.destination.exists())

    def test_unreadable_directory_refuses_before_write(self):
        def failed_walk(*args, **kwargs):
            kwargs["onerror"](PermissionError("unreadable references"))
            return iter(())

        with mock.patch.object(installer.os, "walk", side_effect=failed_walk):
            with self.assertRaises(PermissionError):
                self.run_install()
        self.assertFalse(self.destination.exists())
        self.assertFalse(list(self.destination.parent.glob(".weaver-skill-staging-*")))

    def test_relative_and_parent_traversal_paths_rejected(self):
        for path in (Path("skills"), self.destination.parent / ".." / "skills"):
            with self.subTest(path=path), self.assertRaisesRegex(ValueError, "绝对路径"):
                installer.run("codex", path, True)

    def test_missing_parent_rejected(self):
        with self.assertRaisesRegex(ValueError, "父目录"):
            installer.run("codex", self.root / "missing" / "skills", True)

    def test_source_overlap_rejected(self):
        with self.assertRaisesRegex(ValueError, "重叠"):
            installer.run("codex", self.source, True)
        with self.assertRaisesRegex(ValueError, "重叠"):
            installer.run("codex", self.source.parent, True)

    def test_git_directory_and_worktree_file_rejected(self):
        marker = self.destination.parent / ".git"
        marker.mkdir()
        with self.assertRaisesRegex(ValueError, "Git"):
            self.run_install()
        marker.rmdir()
        marker.write_text("gitdir: elsewhere", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "Git"):
            self.run_install()

    def test_hidden_and_rule_files_rejected(self):
        for name in (".private.md", ".env", "AGENTS.md", "CLAUDE.md", "AGENTS.override.md", "copilot-instructions.md", "SKILL.md.pending"):
            with self.subTest(name=name):
                path = self.source / name
                path.write_text("not included", encoding="utf-8")
                try:
                    with self.assertRaises(ValueError):
                        self.run_install()
                finally:
                    path.unlink()

    def test_os_metadata_does_not_block_or_enter_installed_copy(self):
        expected = installer.inventory(self.source)
        metadata = [".DS_Store", "Thumbs.db", "desktop.ini", "._README.md",
                    "references/.DS_Store", "references/._AGENTS.md", "library/pages/.DS_Store",
                    "knowledge/.DS_Store", "knowledge/Thumbs.db", "knowledge/._file-id.md"]
        for relative in metadata:
            (self.source / relative).write_bytes(b"OS metadata preserved in source")
        self.assertEqual(installer.inventory(self.source), expected)
        self.assertEqual(self.run_install(install=False)["status"], "preview")
        self.assertEqual(self.run_install()["status"], "installed")
        for relative in metadata:
            self.assertEqual((self.source / relative).read_bytes(), b"OS metadata preserved in source")
            self.assertFalse((self.target / relative).exists())
        self.assertEqual(installer.inventory(self.target), expected)

    def test_target_os_metadata_keeps_installation_idempotent(self):
        self.assertEqual(self.run_install()["status"], "installed")
        (self.target / ".DS_Store").write_bytes(b"target Finder metadata")
        self.assertEqual(self.run_install()["status"], "already-present")
        self.assertEqual((self.target / ".DS_Store").read_bytes(), b"target Finder metadata")

    def test_os_metadata_name_does_not_allow_symlink(self):
        metadata = self.source / "._linked-metadata"
        try:
            metadata.symlink_to(self.source / "README.md")
        except (OSError, NotImplementedError):
            self.skipTest("当前测试环境不能创建符号链接")
        with self.assertRaisesRegex(ValueError, "符号链接"):
            self.run_install()
        self.assertTrue(metadata.is_symlink())
        self.assertFalse(self.target.exists())

    def test_nested_skill_entry_rejected(self):
        nested = self.source / "references/SKILL.md"
        nested.write_text("nested", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "嵌套"):
            self.run_install()

    def test_symlink_source_and_destination_paths_rejected(self):
        link = self.root / "linked-parent"
        try:
            link.symlink_to(self.destination.parent, target_is_directory=True)
        except (OSError, NotImplementedError):
            self.skipTest("当前测试环境不能创建符号链接")
        with self.assertRaisesRegex(ValueError, "符号链接"):
            installer.run("codex", link / "skills", True)
        source_link = self.root / "linked-source"
        source_link.symlink_to(self.source, target_is_directory=True)
        with mock.patch.object(installer, "SOURCE_ROOT", source_link), self.assertRaisesRegex(ValueError, "符号链接"):
            self.run_install()
        (self.source / "linked-file.txt").symlink_to(self.source / "README.md")
        with self.assertRaisesRegex(ValueError, "符号链接"):
            self.run_install()

    def test_target_symlink_rejected_without_changing_destination(self):
        self.destination.mkdir()
        try:
            self.target.symlink_to(self.source, target_is_directory=True)
        except (OSError, NotImplementedError):
            self.skipTest("当前测试环境不能创建符号链接")
        before = installer.inventory(self.source)
        with self.assertRaisesRegex(ValueError, "符号链接"):
            self.run_install()
        self.assertEqual(installer.inventory(self.source), before)

    def test_windows_reparse_flag_rejected(self):
        fake = mock.Mock()
        fake.lstat.return_value = SimpleNamespace(st_mode=stat.S_IFDIR, st_file_attributes=0x400)
        with self.assertRaisesRegex(ValueError, "重解析"):
            installer.checked_stat(fake)

    def test_windows_hidden_flag_rejected(self):
        original = installer.checked_stat

        def hidden_readme(path):
            info = original(path)
            if path == self.source / "README.md":
                return SimpleNamespace(st_mode=info.st_mode, st_file_attributes=0x2)
            return info

        with mock.patch.object(installer, "checked_stat", side_effect=hidden_readme), self.assertRaisesRegex(ValueError, "隐藏"):
            self.run_install()

    def test_case_colliding_names_rejected_on_case_insensitive_hosts_too(self):
        walked = [(str(self.source), [], ["README.md", "readme.md"])]
        with mock.patch.object(installer.os, "walk", return_value=walked), self.assertRaisesRegex(ValueError, "同名"):
            installer.inventory(self.source)

    def test_windows_illegal_names_rejected_on_every_os(self):
        for name in ("CON.txt", "NUL", "COM1.log", "LPT9", "COM¹", "x:", "x?", "x\\y", "trailing.", "trailing ", "a\x01b"):
            with self.subTest(name=name), self.assertRaises(ValueError):
                installer.validate_name(name)
        for name in ("中文 空格.md", "openai.yaml", "company.md", "LPT10.txt"):
            installer.validate_name(name)

    @unittest.skipUnless(hasattr(os, "mkfifo"), "此平台没有 mkfifo")
    def test_special_file_rejected_without_reading_it(self):
        os.mkfifo(self.source / "fifo")
        with self.assertRaisesRegex(ValueError, "普通文件"):
            self.run_install()

    def test_copy_failure_preserves_stage_and_never_activates(self):
        with mock.patch.object(installer, "copy_to_stage", side_effect=OSError("simulated failure")):
            result = self.run_install()
        self.assertEqual(result["status"], "incomplete-not-activated")
        self.assertTrue(Path(result["staging"]).exists())
        self.assertFalse((self.target / "SKILL.md").exists())

    def test_move_failure_keeps_pending_entry_outside_skills(self):
        original_link = os.link
        calls = []

        def fail_after_first(source, target):
            calls.append(target)
            if len(calls) == 2:
                raise OSError("simulated unsupported hardlink")
            return original_link(source, target)

        with mock.patch.object(installer.os, "link", side_effect=fail_after_first):
            result = self.run_install()
        self.assertEqual(result["status"], "incomplete-not-activated")
        stage = Path(result["staging"])
        self.assertEqual(stage.parent, self.destination.parent)
        self.assertTrue((stage / installer.PENDING_ENTRY).exists())
        self.assertFalse((self.target / "SKILL.md").exists())
        self.assertFalse(list(stage.rglob("SKILL.md")))

    def test_stage_tampering_refuses_activation(self):
        original = installer.copy_to_stage

        def corrupt(source, stage, expected):
            original(source, stage, expected)
            (stage / "README.md").write_text("corrupted after staging", encoding="utf-8")

        with mock.patch.object(installer, "copy_to_stage", side_effect=corrupt):
            result = self.run_install()
        self.assertEqual(result["status"], "incomplete-not-activated")
        self.assertFalse((self.target / "SKILL.md").exists())

    def test_target_appearing_before_publish_is_not_overwritten(self):
        original = installer.copy_to_stage

        def concurrent_target(source, stage, expected):
            original(source, stage, expected)
            self.target.mkdir(parents=True)
            (self.target / "keep.txt").write_text("existing", encoding="utf-8")

        with mock.patch.object(installer, "copy_to_stage", side_effect=concurrent_target):
            result = self.run_install()
        self.assertEqual(result["status"], "incomplete-not-activated")
        self.assertEqual((self.target / "keep.txt").read_text(encoding="utf-8"), "existing")
        self.assertFalse((self.target / "SKILL.md").exists())

    def test_cleanup_failure_reports_complete_install_separately(self):
        original = Path.unlink

        def keep_pending(path, *args, **kwargs):
            if path.name == installer.PENDING_ENTRY:
                raise OSError("simulated cleanup failure")
            return original(path, *args, **kwargs)

        with mock.patch.object(Path, "unlink", keep_pending):
            result = self.run_install()
        self.assertEqual(result["status"], "installed-cleanup-pending")
        self.assertEqual(installer.inventory(self.target), installer.inventory(self.source))
        self.assertTrue((Path(result["staging"]) / installer.PENDING_ENTRY).exists())

    def test_cli_uses_own_location_and_preview_does_not_make_cache(self):
        completed = subprocess.run([sys.executable, str(self.source / "scripts/install_local.py"),
                                    "--host", "dsh", "--skills-dir", str(self.destination)],
                                   cwd=self.root, text=True, encoding="utf-8", capture_output=True)
        self.assertEqual(completed.returncode, 0, completed.stderr + completed.stdout)
        self.assertEqual(json.loads(completed.stdout)["status"], "preview")
        self.assertFalse(self.destination.exists())
        self.assertFalse(list(self.source.rglob("__pycache__")))

    def test_cli_rejects_arbitrary_source_parameter(self):
        completed = subprocess.run([sys.executable, str(self.source / "scripts/install_local.py"),
                                    "--host", "codex", "--skills-dir", str(self.destination),
                                    "--source", str(self.root)],
                                   cwd=self.root, text=True, encoding="utf-8", capture_output=True)
        self.assertNotEqual(completed.returncode, 0)
        self.assertFalse(self.destination.exists())


if __name__ == "__main__":
    unittest.main()

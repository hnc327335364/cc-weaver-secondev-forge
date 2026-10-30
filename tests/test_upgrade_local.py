"""安装升级和回滚仅使用临时目录；不修改真实宿主配置或技能。"""

import json
import os
from pathlib import Path
import re
import unittest
from unittest import mock

import test_install_local as fixtures

installer = fixtures.installer


class UpgradeLocalTests(unittest.TestCase):
    setUp = fixtures.InstallLocalTests.setUp
    make_library = fixtures.InstallLocalTests.make_library
    make_professional_skills = fixtures.InstallLocalTests.make_professional_skills
    make_professional_modules = fixtures.InstallLocalTests.make_professional_modules
    run_install = fixtures.InstallLocalTests.run_install

    def setup_update(self, professional=False):
        if professional:
            self.make_professional_skills()
        self.assertEqual(self.run_install()["status"], "installed")
        old = installer.inventory(self.target)
        (self.source / "README.md").write_text("新版说明；版本号相同也比较内容。", encoding="utf-8")
        return old

    def upgrade(self, install=True, **kwargs):
        return installer.run("codex", self.destination, install, upgrade=True, **kwargs)

    def rollback(self, record, install=True, **kwargs):
        return installer.run("codex", self.destination, install, rollback=Path(record), **kwargs)

    def test_preview_does_not_write_and_describes_clean_baseline(self):
        old = self.setup_update()
        before = sorted(str(p) for p in self.root.rglob("*"))
        result = self.upgrade(install=False)
        self.assertEqual(result["status"], "upgrade-preview")
        self.assertFalse(result["writes"])
        self.assertFalse(result["requires_backup_acceptance"])
        self.assertEqual(before, sorted(str(p) for p in self.root.rglob("*")))
        self.assertEqual(installer.inventory(self.target), old)

    def test_first_install_preview_lists_external_state_and_staging_without_writes(self):
        before = sorted(str(p) for p in self.root.rglob("*"))
        result = self.run_install(install=False)
        self.assertEqual(result["status"], "preview")
        state_root, _ = installer.state_paths(self.destination)
        self.assertEqual(result["local_state_directory"], str(state_root))
        self.assertEqual(result["staging_parent"], str(self.destination.parent))
        self.assertFalse(state_root.is_relative_to(self.destination))
        self.assertFalse(state_root.exists())
        self.assertFalse(self.target.exists())
        self.assertEqual(before, sorted(str(p) for p in self.root.rglob("*")))

    def test_clean_upgrade_keeps_full_backup_outside_scan_and_is_idempotent(self):
        old = self.setup_update(professional=True)
        result = self.upgrade()
        self.assertEqual(result["status"], "upgraded")
        backup = Path(result["backup"])
        self.assertFalse(backup.is_relative_to(self.destination))
        self.assertEqual(installer.inventory(backup / "package"), old)
        self.assertEqual(installer.inventory(self.target), installer.inventory(self.source))
        self.assertEqual(len(list(self.destination.rglob("SKILL.md"))), 9)
        self.assertEqual(installer.baseline(self.destination, self.target), installer.inventory(self.source))
        self.assertEqual(self.upgrade()["status"], "already-present")

    def test_upgrade_old_multi_skill_to_single_skill_and_restore_old_layout(self):
        self.make_professional_skills()
        self.assertEqual(self.run_install()["status"], "installed")
        old = installer.inventory(self.target)
        # 新发行副本只迁移模块文件名；模拟真实接收方保留旧多入口版。
        registry_path = self.source / "capabilities.json"
        registry = json.loads(registry_path.read_text(encoding="utf-8"))
        for item in registry["skills"]:
            previous = self.source / item["path"]
            item["path"] = item["path"].replace("/SKILL.md", "/MODULE.md")
            previous.rename(self.source / item["path"])
        registry["schema_version"] = 2
        registry["modules"] = registry.pop("skills")
        registry_path.write_text(json.dumps(registry), encoding="utf-8")
        preview = self.upgrade(install=False)
        self.assertEqual(preview["discoverable_skill_count"], 1)
        result = self.upgrade()
        self.assertEqual(result["status"], "upgraded")
        self.assertEqual(list(self.target.rglob("SKILL.md")), [self.target / "SKILL.md"])
        self.assertEqual(len(list((self.target / "skills").rglob("MODULE.md"))), 8)
        self.assertEqual(installer.inventory(Path(result["backup"]) / "package"), old)
        restored = self.rollback(result["rollback_record"])
        self.assertEqual(restored["status"], "rolled-back")
        self.assertEqual(restored["discoverable_skill_count"], 9)
        self.assertEqual(installer.inventory(self.target), old)

    def test_modified_and_unmanaged_files_require_explicit_backup_acceptance(self):
        self.setup_update()
        (self.target / "README.md").write_text("用户修改", encoding="utf-8")
        (self.target / "personal-note.txt").write_text("用户资料", encoding="utf-8")
        (self.target / "personal-folder").mkdir()
        old = installer.inventory(self.target)
        preview = self.upgrade(install=False)
        self.assertEqual(preview["local_change_counts"]["changed"], 1)
        self.assertEqual(preview["local_change_counts"]["unmanaged"], 1)
        self.assertTrue(preview["requires_backup_acceptance"])
        before = sorted(str(p) for p in self.root.rglob("*"))
        with self.assertRaisesRegex(ValueError, "仅保存在备份"):
            self.upgrade()
        self.assertEqual(before, sorted(str(p) for p in self.root.rglob("*")))
        result = self.upgrade(accept_local_changes_backup=True)
        self.assertEqual(result["status"], "upgraded")
        self.assertEqual(installer.inventory(Path(result["backup"]) / "package"), old)
        self.assertFalse((self.target / "personal-note.txt").exists())
        self.assertFalse((self.target / "personal-folder").exists())
        self.assertIn("没有自动合并", result["local_changes"])

    def test_legacy_without_baseline_requires_acceptance(self):
        old = self.setup_update()
        _, baseline_path = installer.state_paths(self.destination)
        baseline_path.unlink()
        preview = self.upgrade(install=False)
        self.assertEqual(preview["baseline"], "unavailable")
        with self.assertRaisesRegex(ValueError, "旧版无基线"):
            self.upgrade()
        result = self.upgrade(accept_local_changes_backup=True)
        self.assertEqual(installer.inventory(Path(result["backup"]) / "package"), old)

    def test_rollback_preserves_current_package_and_original_local_changes(self):
        self.setup_update()
        (self.target / "personal-note.txt").write_text("旧版个人记录", encoding="utf-8")
        (self.target / "README.md").write_text("旧版个人说明", encoding="utf-8")
        old = installer.inventory(self.target)
        update = self.upgrade(accept_local_changes_backup=True)
        new = installer.inventory(self.target)
        before = sorted(str(p) for p in self.root.rglob("*"))
        preview = self.rollback(update["rollback_record"], install=False)
        self.assertEqual(preview["status"], "rollback-preview")
        self.assertEqual(before, sorted(str(p) for p in self.root.rglob("*")))
        result = self.rollback(update["rollback_record"])
        self.assertEqual(result["status"], "rolled-back")
        self.assertEqual(installer.inventory(self.target), old)
        self.assertEqual(installer.inventory(Path(result["backup"]) / "package"), new)
        # 个人文件不能因回滚成为受管文件，下次升级仍需要明确处理。
        self.assertTrue(self.upgrade(install=False)["requires_backup_acceptance"])

    def test_rollback_to_legacy_does_not_invent_managed_baseline(self):
        self.setup_update()
        _, path = installer.state_paths(self.destination)
        path.unlink()
        update = self.upgrade(accept_local_changes_backup=True)
        self.rollback(update["rollback_record"])
        self.assertIsNone(installer.baseline(self.destination, self.target))

    def test_rollback_can_restore_missing_target_after_interruption(self):
        old = self.setup_update()
        update = self.upgrade()
        self.target.rename(self.root / "isolated-current-package")
        preview = self.rollback(update["rollback_record"], install=False)
        self.assertEqual(preview["status"], "rollback-preview")
        self.assertFalse(self.target.exists())
        restored = self.rollback(update["rollback_record"])
        self.assertEqual(restored["status"], "rolled-back")
        self.assertEqual(installer.inventory(self.target), old)

    def test_state_directory_cannot_be_the_skill_scan_root(self):
        target = self.root / "weaver-cc-install-state"
        with self.assertRaisesRegex(ValueError, "重叠"):
            installer.state_paths(target)

    def test_rollback_current_user_changes_need_acceptance_and_remain_in_new_backup(self):
        self.setup_update()
        update = self.upgrade()
        (self.target / "new-local.txt").write_text("升级后修改", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "仅保存在备份"):
            self.rollback(update["rollback_record"])
        result = self.rollback(update["rollback_record"], accept_local_changes_backup=True)
        self.assertEqual((Path(result["backup"]) / "package/new-local.txt").read_text(encoding="utf-8"), "升级后修改")

    def test_activation_failure_restores_previous_and_keeps_failed_copy(self):
        old = self.setup_update(professional=True)
        original = installer.os.link
        def fail_root(source, target):
            if target == self.target / "SKILL.md":
                raise OSError("simulated root activation failure")
            return original(source, target)
        with mock.patch.object(installer.os, "link", side_effect=fail_root):
            result = self.upgrade()
        self.assertEqual(result["status"], "upgrade-failed-restored")
        self.assertTrue(result["previous_restored"])
        self.assertEqual(installer.inventory(self.target), old)
        self.assertTrue((Path(result["backup"]) / "failed-new-package").is_dir())

    def test_target_changed_during_staging_is_not_moved(self):
        self.setup_update()
        original = installer.copy_to_stage
        def concurrent(source, stage, expected):
            original(source, stage, expected)
            (self.target / "concurrent.txt").write_text("保留并发内容", encoding="utf-8")
        with mock.patch.object(installer, "copy_to_stage", side_effect=concurrent):
            result = self.upgrade()
        self.assertEqual(result["status"], "upgrade-failed-restored")
        self.assertEqual((self.target / "concurrent.txt").read_text(encoding="utf-8"), "保留并发内容")

    def test_invalid_backup_locations_refuse_without_writes(self):
        self.setup_update()
        candidates = [self.destination, self.target, self.source, self.source / "backup", Path("relative")]
        for candidate in candidates:
            with self.subTest(candidate=candidate), self.assertRaises(ValueError):
                self.upgrade(backup_dir=candidate)
        self.assertFalse((self.source / "backup").exists())

    def test_symlink_backup_parent_is_rejected(self):
        self.setup_update()
        link = self.root / "linked-backup"
        link.symlink_to(self.destination.parent, target_is_directory=True)
        with self.assertRaisesRegex(ValueError, "链接"):
            self.upgrade(backup_dir=link)

    def test_corrupt_baseline_is_not_treated_as_clean(self):
        self.setup_update()
        _, path = installer.state_paths(self.destination)
        record = json.loads(path.read_text(encoding="utf-8"))
        record["inventory_sha256"] = "0" * 64
        path.write_text(json.dumps(record), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "基线指纹"):
            self.upgrade()

    def test_tampered_backup_receipt_paths_hash_and_content_refuse(self):
        self.setup_update()
        result = self.upgrade()
        path = Path(result["rollback_record"])
        original = path.read_text(encoding="utf-8")
        cases = [("target", str(self.root / "other")), ("host", "dsh"),
                 ("package", "../weaver-cc-assistant"), ("inventory_sha256", "0" * 64),
                 ("managed_baseline_sha256", "0" * 64)]
        for key, value in cases:
            record = json.loads(original)
            record[key] = value
            path.write_text(json.dumps(record), encoding="utf-8")
            with self.subTest(key=key), self.assertRaises(ValueError):
                self.rollback(path)
        record = json.loads(original)
        record["inventory"]["files"]["../escape.txt"] = {"bytes": 1, "sha256": "0" * 64}
        record["inventory_sha256"] = installer.inventory_digest(record["inventory"])
        path.write_text(json.dumps(record), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "越界"):
            self.rollback(path)
        path.write_text(original, encoding="utf-8")
        (path.parent / "package/README.md").write_text("备份被改", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "备份内容已改变"):
            self.rollback(path)

    def test_backup_on_another_volume_is_rejected(self):
        self.setup_update()
        parent = self.root / "different-volume"
        parent.mkdir()
        original = Path.stat
        def other_device(path, *args, **kwargs):
            value = original(path, *args, **kwargs)
            if path == parent:
                values = list(value)
                values[2] = value.st_dev + 1
                return os.stat_result(values)
            return value
        with mock.patch.object(Path, "stat", other_device), self.assertRaisesRegex(ValueError, "同卷"):
            self.upgrade(backup_dir=parent)

    def test_incompatible_modes_and_missing_target_are_rejected(self):
        with self.assertRaisesRegex(ValueError, "同时"):
            installer.run("codex", self.destination, upgrade=True, rollback=self.root / "restore.json")
        with self.assertRaisesRegex(ValueError, "不存在"):
            self.upgrade()
        with self.assertRaisesRegex(ValueError, "仅用于"):
            installer.run("codex", self.destination, accept_local_changes_backup=True)

    def make_legacy_target(self):
        self.run_install()
        (self.target / "library").rename(self.root / "fixture-library-outside-legacy")
        entry = self.target / "SKILL.md"
        text = re.sub(r'(?m)^(\s+version:)\s*[^\r\n]+', r'\1 "0.1.0"', entry.read_text(encoding="utf-8"))
        entry.write_text(text, encoding="utf-8")
        _, state = installer.state_paths(self.destination)
        state.unlink()
        return installer.inventory(self.target)

    def test_legacy_knowledge_only_upgrade_and_complete_rollback(self):
        old = self.make_legacy_target()
        before = sorted(str(p) for p in self.root.rglob("*"))
        preview = self.upgrade(install=False)
        self.assertEqual(preview["backup_layout"], "legacy-knowledge-only-v0.1.0")
        self.assertEqual(before, sorted(str(p) for p in self.root.rglob("*")))
        update = self.upgrade(accept_local_changes_backup=True)
        self.assertEqual(update["status"], "upgraded")
        restore_preview = self.rollback(update["rollback_record"], install=False)
        self.assertEqual(restore_preview["full_library"]["status"], "legacy-knowledge-only-v0.1.0")
        self.assertIsNone(restore_preview["manifest_paths"]["full_library"])
        restored = self.rollback(update["rollback_record"])
        self.assertEqual(restored["status"], "rolled-back")
        self.assertEqual(installer.inventory(self.target), old)
        self.assertFalse((self.target / "library").exists())
        self.assertEqual(self.rollback(update["rollback_record"])["status"], "already-present")

    def test_legacy_knowledge_only_rollback_to_missing_target(self):
        old = self.make_legacy_target()
        update = self.upgrade(accept_local_changes_backup=True)
        self.target.rename(self.root / "isolated-new-version")
        restored = self.rollback(update["rollback_record"])
        self.assertEqual(restored["status"], "rolled-back")
        self.assertEqual(installer.inventory(self.target), old)

    def test_damaged_legacy_is_rejected_before_upgrade_writes(self):
        self.make_legacy_target()
        manifest = json.loads((self.target / "knowledge/manifest.json").read_text(encoding="utf-8"))
        (self.target / "knowledge" / manifest["entries"][0]["file"]).write_text("损坏", encoding="utf-8")
        before = sorted(str(p) for p in self.root.rglob("*"))
        with self.assertRaisesRegex(ValueError, "变更"):
            self.upgrade(accept_local_changes_backup=True)
        self.assertEqual(before, sorted(str(p) for p in self.root.rglob("*")))

    def test_modern_target_missing_library_is_not_legacy(self):
        self.setup_update()
        (self.target / "library").rename(self.root / "lost-modern-library")
        with self.assertRaisesRegex(ValueError, "不是可恢复"):
            self.upgrade(accept_local_changes_backup=True)

    def test_new_install_still_requires_library_even_when_declaring_legacy_version(self):
        (self.source / "library").rename(self.root / "isolated-source-library")
        entry = self.source / "SKILL.md"
        entry.write_text(re.sub(r'(?m)^(\s+version:)\s*[^\r\n]+', r'\1 "0.1.0"',
                                entry.read_text(encoding="utf-8")), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "缺少完整资料库"):
            self.run_install()
        self.assertFalse(self.target.exists())


if __name__ == "__main__":
    unittest.main()

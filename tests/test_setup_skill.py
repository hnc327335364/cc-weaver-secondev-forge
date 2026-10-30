"""交互安装只在隔离目录验证；不代表三个宿主或 Windows 的实际发现验收。"""

import contextlib
import io
from pathlib import Path
import sys
import unittest
from unittest import mock

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import setup_skill as setup
import test_install_local as fixtures

installer = fixtures.installer


class SetupSkillTests(unittest.TestCase):
    make_library = fixtures.InstallLocalTests.make_library

    def setUp(self):
        # 复用小正文夹具，避免每个路径/授权用例都复制真实知识库。
        fixtures.InstallLocalTests.setUp(self)
        patcher = mock.patch.object(setup, "installer", installer)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.user = self.root / "使用者 中文 空格"
        self.user.mkdir()

    def choose(self, host, explicit=None, env=None):
        return setup.choose_directory(host, explicit, self.user, env or {})

    def run_main(self, argv, answers=()):
        output = io.StringIO()
        with mock.patch.object(sys, "argv", ["setup_skill.py", *argv]), \
                mock.patch("builtins.input", side_effect=list(answers)), \
                contextlib.redirect_stdout(output):
            result = setup.main()
        return result, output.getvalue()

    def test_known_defaults_use_current_home(self):
        self.assertEqual(self.choose("codex"), self.user / ".agents/skills")
        self.assertEqual(self.choose("workbuddy"), self.user / ".workbuddy/skills")
        self.assertEqual(self.choose("dsh"), self.user / ".dsh/skills")

    def test_workbuddy_config_and_dsh_home_are_respected(self):
        custom = self.user / "自定义 实例"
        self.assertEqual(self.choose("workbuddy", env={"WORKBUDDY_CONFIG_DIR": str(custom)}), custom / "skills")
        self.assertEqual(self.choose("dsh", env={"DSH_HOME": str(custom)}), custom / "skills")

    def test_explicit_directory_does_not_guess_other_host_roots(self):
        explicit = self.user / "已核实 根/skills"
        self.assertEqual(self.choose("workbuddy", explicit, {"WORKBUDDY_INSTANCE_NUMBER": "2"}), explicit)

    def test_relative_and_parent_traversal_are_rejected(self):
        for value in (Path("relative/skills"), self.user / "x/../skills"):
            with self.subTest(value=value), self.assertRaises(ValueError):
                self.choose("codex", value)

    def test_workbuddy_multiple_instances_require_verified_root(self):
        with self.assertRaisesRegex(ValueError, "多实例"):
            self.choose("workbuddy", env={"WORKBUDDY_INSTANCE_NUMBER": "2"})

    def test_existing_codex_legacy_install_is_reused(self):
        existing = self.user / ".codex/skills"
        (existing / installer.SKILL_NAME).mkdir(parents=True)
        self.assertEqual(self.choose("codex"), existing)

    def test_custom_codex_home_existing_install_is_reused(self):
        custom = self.user / "自定义 Codex"
        (custom / "skills" / installer.SKILL_NAME).mkdir(parents=True)
        self.assertEqual(self.choose("codex", env={"CODEX_HOME": str(custom)}), custom / "skills")

    def test_dsh_reuses_shared_install_without_second_copy(self):
        shared = self.user / ".agents/skills"
        (shared / installer.SKILL_NAME).mkdir(parents=True)
        self.assertEqual(self.choose("dsh"), shared)

    def test_multiple_visible_copies_require_resolution(self):
        for root in (self.user / ".agents/skills", self.user / ".dsh/skills"):
            (root / installer.SKILL_NAME).mkdir(parents=True)
        with self.assertRaisesRegex(ValueError, "多个同名"):
            self.choose("dsh")

    def test_old_identity_is_not_silently_duplicated(self):
        (self.user / ".workbuddy/skills/weaver-department-assistant").mkdir(parents=True)
        with self.assertRaisesRegex(ValueError, "旧标识"):
            self.choose("workbuddy")

    def test_preview_does_not_create_missing_parent_or_state(self):
        destination = self.user / ".agents/skills"
        before = sorted(str(path) for path in self.user.rglob("*"))
        plan = setup.preview("codex", destination)
        self.assertFalse(plan["writes"])
        self.assertEqual(plan["create_parent_directories"], [str(destination.parent)])
        self.assertEqual(before, sorted(str(path) for path in self.user.rglob("*")))
        self.assertFalse(destination.parent.exists())

    def test_preview_rejects_source_overlap(self):
        for destination in (self.source, self.source / "skills", self.source.parent):
            with self.subTest(destination=destination), self.assertRaises(ValueError):
                setup.preview("codex", destination)

    def test_preview_rejects_linked_parent(self):
        linked = self.user / "linked"
        linked.symlink_to(self.destination.parent, target_is_directory=True)
        with self.assertRaisesRegex(ValueError, "链接"):
            setup.preview("codex", linked / "new/skills")

    def test_missing_target_in_git_project_is_rejected_before_creation(self):
        project = self.user / "客户工程"
        (project / ".git").mkdir(parents=True)
        destination = project / "new-parent/skills"
        with self.assertRaises(ValueError):
            setup.preview("codex", destination)
        self.assertFalse(destination.parent.exists())

    def test_state_root_overlap_is_rejected_before_creating_missing_parent(self):
        destination = self.user / "new-parent/weaver-cc-install-state"
        with self.assertRaisesRegex(ValueError, "状态目录"):
            setup.preview("codex", destination)
        self.assertFalse(destination.parent.exists())

    def test_first_install_creates_only_confirmed_tree_and_is_idempotent(self):
        destination = self.user / ".agents/skills"
        plan = setup.preview("codex", destination)
        result = setup.execute(plan)
        self.assertEqual(result["status"], "installed")
        self.assertEqual(installer.inventory(destination / installer.SKILL_NAME), installer.inventory(self.source))
        repeated = setup.preview("codex", destination)
        self.assertEqual(repeated["status"], "already-present")
        self.assertFalse(setup.execute(repeated)["writes"])

    def test_all_host_names_use_same_install_contract(self):
        for host in setup.LABELS:
            with self.subTest(host=host):
                destination = self.user / host / "skills"
                result = setup.execute(setup.preview(host, destination))
                self.assertEqual(result["status"], "installed")
                self.assertTrue((destination / installer.SKILL_NAME / "SKILL.md").is_file())

    def test_parent_change_after_confirmation_is_rejected(self):
        destination = self.user / ".agents/skills"
        plan = setup.preview("codex", destination)
        destination.parent.mkdir()
        with self.assertRaisesRegex(ValueError, "目录结构发生变化"):
            setup.execute(plan)
        self.assertFalse(destination.exists())

    def test_upgrade_preserves_old_content_in_backup(self):
        plan = setup.preview("codex", self.destination)
        self.assertEqual(setup.execute(plan)["status"], "installed")
        old_readme = (self.target / "README.md").read_bytes()
        with (self.source / "README.md").open("a", encoding="utf-8") as stream:
            stream.write("\n隔离测试新版\n")
        upgrade = setup.preview("codex", self.destination)
        self.assertTrue(upgrade["upgrade"])
        result = setup.execute(upgrade)
        self.assertEqual(result["status"], "upgraded")
        self.assertEqual((Path(result["backup"]) / "package/README.md").read_bytes(), old_readme)

    def test_local_changes_require_separate_acceptance(self):
        setup.execute(setup.preview("codex", self.destination))
        personal = self.target / "personal.txt"
        personal.write_text("接收方改动", encoding="utf-8")
        with (self.source / "README.md").open("a", encoding="utf-8") as stream:
            stream.write("\n新版\n")
        plan = setup.preview("codex", self.destination)
        with self.assertRaisesRegex(ValueError, "单独确认"):
            setup.execute(plan)
        self.assertEqual(personal.read_text(encoding="utf-8"), "接收方改动")
        result = setup.execute(plan, accept_local_changes=True)
        self.assertEqual(result["status"], "upgraded")
        self.assertFalse((self.target / "personal.txt").exists())
        self.assertEqual((Path(result["backup"]) / "package/personal.txt").read_text(encoding="utf-8"), "接收方改动")

    def test_cancel_before_confirmation_leaves_missing_parent_absent(self):
        destination = self.user / ".agents/skills"
        code, output = self.run_main(["--host", "codex", "--skills-dir", str(destination)], ["n"])
        self.assertEqual(code, 0)
        self.assertIn("已取消", output)
        self.assertFalse(destination.parent.exists())

    def test_machine_preview_is_read_only_and_json(self):
        destination = self.user / ".agents/skills"
        code, output = self.run_main(["--host", "codex", "--skills-dir", str(destination), "--preview"])
        self.assertEqual(code, 0)
        self.assertIn('"writes": false', output)
        self.assertFalse(destination.parent.exists())

    def test_noninteractive_missing_host_does_not_guess(self):
        code, output = self.run_main(["--preview"])
        self.assertEqual(code, 1)
        self.assertIn("须指定 --host", output)

    def test_cancel_host_menu_never_reaches_install(self):
        with mock.patch.object(setup, "preview") as preview:
            code, output = self.run_main([], ["q"])
        self.assertEqual(code, 0)
        preview.assert_not_called()


if __name__ == "__main__":
    unittest.main()

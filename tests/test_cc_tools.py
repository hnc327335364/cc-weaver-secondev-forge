"""统一工具门禁与共享字典的本地回归；不调用任何远端系统。"""
import importlib.util
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import cc_tools
import knowledge_lookup
from library_reader import Library, DEFAULT_ROOT


class ToolPermissions(unittest.TestCase):
    def test_local_commands(self):
        for tool, args in [("frontend", ["build", "project"]), ("backend", ["init", "project", "--skeleton-only"]),
                           ("backend", ["init", "project", "--lib-archive-file", "lib.zip", "--classes-archive-file", "classes.zip"]),
                           ("integration", ["sync", "apply", "--dry-run"]), ("security", ["prepare"]),
                           ("performance", ["validate"]), ("pages", ["status"])]:
            with self.subTest(tool=tool, args=args):
                self.assertFalse(cc_tools.check_permission(tool, args)["network"])

    def test_implicit_download_needs_confirmation(self):
        for tool, args in [("backend", ["init", "project"]), ("pages", ["doctor"]), ("pages", ["protocol"]),
                           ("pages", ["run", "--", "init"]), ("login", ["current"]), ("login", ["tenants"])]:
            with self.subTest(tool=tool):
                with self.assertRaises(ValueError):
                    cc_tools.check_permission(tool, args)

    def test_nonproduction_reads(self):
        for args in (["system", "version"], ["project", "list"], ["tree", "list"], ["file", "get"]):
            result = cc_tools.check_permission("platform", args, allow_network=True, environment="test", confirmed=True)
            self.assertFalse(result["remote_write"])

    def test_production_or_unknown_rejected(self):
        for env in (None, "production", "prod", "unknown"):
            with self.assertRaises(ValueError):
                cc_tools.check_permission("login", ["current"], allow_network=True, environment=env, confirmed=True)

    def test_upload_validation_is_write(self):
        with self.assertRaises(ValueError):
            cc_tools.check_permission("platform", ["package", "check"], allow_network=True, environment="test", confirmed=True)
        self.assertTrue(cc_tools.check_permission("platform", ["package", "check"], allow_network=True, environment="test",
                                                confirmed=True, allow_remote_write=True, change_note="仅上传核验此包")["remote_write"])

    def test_page_build_does_not_require_publish_permission(self):
        for action in ("build", "next"):
            result = cc_tools.check_permission("pages", ["run", "--", action], allow_network=True,
                                               environment="development", confirmed=True)
            self.assertFalse(result["remote_write"])
        with self.assertRaises(ValueError):
            cc_tools.check_permission("pages", ["run", "--", "platform", "deploy"], allow_network=True,
                                      environment="test", confirmed=True)

    def test_unknown_and_unrestricted_request_rejected(self):
        for tool, args in [("platform", ["file", "delete"]), ("login", ["request", "/any"]), ("backend", ["arbitrary"])]:
            with self.assertRaises(ValueError):
                cc_tools.classify(tool, args)

    def test_unsafe_flags_rejected(self):
        for flag in ("--force", "--force=true", "--insecure", "--template-url=x", "--password=x", "--auto-publish", "--cover-config"):
            with self.subTest(flag=flag):
                with self.assertRaises(ValueError):
                    cc_tools.classify("frontend", ["init", "dir", flag])

    def test_denied_command_never_starts_child(self):
        with patch.object(cc_tools.subprocess, "run") as child:
            self.assertEqual(cc_tools.main(["run", "login", "--", "login", "--url", "https://example.invalid"]), 1)
            child.assert_not_called()

    def test_credential_storage_outside_bundle(self):
        with self.assertRaises(ValueError):
            cc_tools.check_storage("login", ["login", "--state", str(ROOT / "session.json")])
        with patch.dict(os.environ, {"ECODE_PAGE_RUNTIME_HOME": str(ROOT / "runtime")}):
            with self.assertRaises(ValueError):
                cc_tools.check_storage("pages", ["status"])

    def test_duplicate_and_tilde_state_rejected(self):
        with self.assertRaises(ValueError):
            cc_tools.classify("login", ["login", "--state", "/tmp/ok", "--state=" + str(ROOT / "secret")])
        with self.assertRaises(ValueError):
            cc_tools.check_storage("login", ["login", "--state", "~/session.json"])

    def test_global_state_before_platform_command(self):
        result = cc_tools.check_permission("platform", ["--state", "/tmp/cc-example-state", "system", "version"],
                                          allow_network=True, environment="test", confirmed=True)
        self.assertFalse(result["remote_write"])

    def test_export_does_not_overwrite(self):
        with tempfile.TemporaryDirectory() as temp:
            existing = Path(temp) / "source.js"
            existing.write_text("user", encoding="utf-8")
            with self.assertRaises(ValueError):
                cc_tools.check_storage("platform", ["file", "get", "--source-out=" + str(existing)])
            self.assertEqual(existing.read_text(), "user")


class SharedDictionary(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.library = Library(DEFAULT_ROOT)

    @classmethod
    def tearDownClass(cls):
        cls.library.db.close()

    def test_exact_table_load(self):
        # 统一索引内同库也可能有多来源；明确本测试核对的 JSON 来源，不静默合并。
        source = "ecode-toolkit" if self.library.manifest.get("extensions", {}).get("dictionary") else None
        value = knowledge_lookup.dictionary(self.library, "load", "form_field", database="formreport", source=source)
        self.assertEqual(value["record"]["tableName"], "form_field")
        self.assertIn("title", {item["name"] for item in value["record"]["columns"]})
        self.assertIn("objects/", value["source"]["object_path"])

    def test_wrong_database_rejected(self):
        with self.assertRaises(ValueError):
            knowledge_lookup.dictionary(self.library, "load", "form_field", database="not-this-database")

    def test_search_ranks_exact_name_first(self):
        result = knowledge_lookup.dictionary(self.library, "search", "form_field", limit=2)
        self.assertEqual(result["results"][0]["tableName"], "form_field")

    def test_column_database_filter(self):
        result = knowledge_lookup.dictionary(self.library, "find-column", "title", database="formreport", limit=100)
        self.assertGreater(result["total"], 0)
        self.assertTrue(any(item["tableName"] == "form_field" for item in result["results"]))

    def test_source_resolution(self):
        result = knowledge_lookup.resolve(self.library, "skills/e10-local-knowledge/SKILL.md")
        self.assertEqual(result["source_id"], "ecode-toolkit")

    def test_path_escape_and_missing_table_rejected(self):
        for path in ("../secret", "/tmp/secret", "skills/../../secret", "skills/no-such-source"):
            with self.assertRaises(ValueError):
                knowledge_lookup.resolve(self.library, path)


if __name__ == "__main__":
    unittest.main()

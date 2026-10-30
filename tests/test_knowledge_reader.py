import importlib.util
import hashlib
import json
import os
import subprocess
import sys
import tempfile
import unittest
from unittest import mock
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "knowledge_reader.py"
SPEC = importlib.util.spec_from_file_location("knowledge_reader", SCRIPT)
reader = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(reader)


class ReaderTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="knowledge-reader-")
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.root = self.base / "资料 空格"
        self.root.mkdir()
        (self.root / "动作流.md").write_text("# E10动作流\n## HTTP触发\n接口：triggerActionFlow\n## SDK触发\nMQ前提待核实\n", encoding="utf-8")
        (self.root / "AGENTS.md").write_text("# 不能作为知识命中\ntriggerActionFlow", encoding="utf-8")
        (self.root / ".hidden").mkdir()
        (self.root / ".hidden" / "private.md").write_text("triggerActionFlow", encoding="utf-8")
        (self.root / "table.json").write_text('{"table":"example"}', encoding="utf-8")
        raw = self.root / "99-SourceFiles 原始资料"
        raw.mkdir()
        (raw / "原件.md").write_text("# 原始参考\nraw-only-token", encoding="utf-8")

    def test_search_outline_load_and_hash(self):
        result = reader.search(self.root, "E10 triggerActionFlow")
        self.assertEqual(result["matched_files"], 1)
        hit = result["results"][0]
        self.assertEqual(hit["source_id"], "动作流.md")
        self.assertEqual(reader.outline(self.root, hit["source_id"])["headings"][1]["line"], 2)
        loaded = reader.load(self.root, hit["source_id"], 2, 2, hit["sha256"])
        self.assertEqual(loaded["text"], "2: ## HTTP触发\n3: 接口：triggerActionFlow")
        (self.root / "动作流.md").write_text("changed", encoding="utf-8")
        with self.assertRaises(ValueError):
            reader.load(self.root, hit["source_id"], expected_sha256=hit["sha256"])

    def test_paths_and_symlink_escape_rejected(self):
        for source in ["../secret.md", "/etc/passwd", "C:/secret.md", "x\\secret.md", "x/../secret.md"]:
            with self.subTest(source=source), self.assertRaises(ValueError):
                reader.resolve_source(self.root, source)
        outside = self.base / "outside.md"
        outside.write_text("sensitive triggerActionFlow")
        try:
            (self.root / "linked.md").symlink_to(outside)
        except (OSError, NotImplementedError):
            self.skipTest("当前环境不允许创建链接；链接保护未实测，不计为通过")
        self.assertEqual(reader.search(self.root, "sensitive")["matched_files"], 0)
        with self.assertRaises(ValueError):
            reader.load(self.root, "linked.md")

    def test_bounds_and_supported_formats(self):
        self.assertIn('"table"', reader.load(self.root, "table.json")["text"])
        for start, lines in [(0, 1), (100, 1), (1, 0), (1, 121)]:
            with self.subTest(start=start, lines=lines), self.assertRaises(ValueError):
                reader.load(self.root, "动作流.md", start, lines)
        (self.root / "large.md").write_bytes(b"x" * (reader.MAX_FILE_BYTES + 1))
        with self.assertRaises(ValueError):
            reader.load(self.root, "large.md")
        self.assertEqual(reader.search(self.root, "E10")["skipped_files"], 1)

    def test_zero_hits_and_cli_do_not_mutate(self):
        before = {p.relative_to(self.root).as_posix(): p.read_bytes() for p in self.root.rglob("*") if p.is_file()}
        output = subprocess.run([sys.executable, "-B", str(SCRIPT), "--root", str(self.root), "search", "not-found"], check=True, capture_output=True, encoding="utf-8")
        self.assertEqual(json.loads(output.stdout)["results"], [])
        after = {p.relative_to(self.root).as_posix(): p.read_bytes() for p in self.root.rglob("*") if p.is_file()}
        self.assertEqual(before, after)
        self.assertNotIn(str(self.root), output.stdout)

    def test_raw_material_requires_explicit_scope(self):
        self.assertEqual(reader.search(self.root, "raw-only-token")["matched_files"], 0)
        self.assertEqual(reader.search(self.root / "99-SourceFiles 原始资料", "raw-only-token")["matched_files"], 1)

    def test_fence_length_preserves_real_headings(self):
        text = "# Real\n````markdown\n```python\n# Not real\n```\n````\n## Next\n"
        self.assertEqual([h["title"] for h in reader.headings(text)], ["Real", "Next"])

    def test_truncation_reports_only_returned_lines(self):
        (self.root / "long-line.md").write_text("first\n" + "中" * 15000 + "\nthird\nfourth\n", encoding="utf-8")
        loaded = reader.load(self.root, "long-line.md", 1, 4)
        self.assertEqual((loaded["end_line"], loaded["next_line"]), (1, 2))
        self.assertTrue(loaded["truncated"])
        self.assertFalse(loaded["partial_last_line"])
        partial = reader.load(self.root, "long-line.md", 2, 3)
        self.assertEqual((partial["end_line"], partial["next_line"]), (2, 2))
        self.assertTrue(partial["partial_last_line"])
        self.assertEqual(len(partial["text"]), 14000)

    def test_filename_only_hit_has_no_claimed_body_line(self):
        (self.root / "empty-topic.md").write_text("")
        hit = reader.search(self.root, "empty-topic")["results"][0]
        self.assertIsNone(hit["first_match_line"])
        self.assertEqual(hit["match_scope"], "path-or-metadata-only")

    def test_utf8_output_with_legacy_stdout_setting(self):
        environment = dict(os.environ, PYTHONIOENCODING="cp1252")
        result = subprocess.run([sys.executable, "-B", str(SCRIPT), "--root", str(self.root), "search", "动作流"], env=environment, capture_output=True, encoding="utf-8", check=True)
        self.assertEqual(json.loads(result.stdout)["results"][0]["title"], "E10动作流")

    def make_bundle(self):
        root = self.base / "bundle"
        root.mkdir()
        body = "# 随包知识\nfileId与docId不同\n".encode("utf-8")
        (root / "file-id.md").write_bytes(body)
        manifest = {"schema_version": 1, "status": "internal-trial-subset", "entries": [
            {"id": "file-id", "file": "file-id.md", "sha256": hashlib.sha256(body).hexdigest(), "bytes": len(body)}]}
        (root / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
        return root

    def test_verify_bundle_and_content_change(self):
        root = self.make_bundle()
        self.assertEqual(reader.verify_bundle(root)["checked_notes"], 1)
        (root / "file-id.md").write_text("changed", encoding="utf-8")
        with self.assertRaises(ValueError):
            reader.verify_bundle(root)

    def test_bundle_ignores_only_regular_os_metadata_without_deleting_it(self):
        root = self.make_bundle()
        for name in (".DS_Store", "Thumbs.db", "desktop.ini", "._file-id.md"):
            (root / name).write_bytes(b"OS metadata")
        before = {path.name: path.read_bytes() for path in root.iterdir()}
        self.assertEqual(reader.verify_bundle(root)["checked_notes"], 1)
        self.assertEqual(before, {path.name: path.read_bytes() for path in root.iterdir()})
        (root / ".private.md").write_text("must not ignore", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "清单外"):
            reader.verify_bundle(root)

    def test_bundle_metadata_name_cannot_hide_symlink(self):
        root = self.make_bundle()
        try:
            (root / ".DS_Store").symlink_to(root / "file-id.md")
        except (OSError, NotImplementedError):
            self.skipTest("当前测试环境不能创建符号链接")
        with self.assertRaisesRegex(ValueError, "链接"):
            reader.verify_bundle(root)

    def test_verify_bundle_refuses_unreadable_subtree(self):
        root = self.make_bundle()

        def failed_walk(*args, **kwargs):
            kwargs["onerror"](PermissionError("unreadable knowledge subtree"))
            return iter(())

        with mock.patch.object(reader.os, "walk", side_effect=failed_walk):
            with self.assertRaises(PermissionError):
                reader.verify_bundle(root)

    def test_bundle_rejects_extra_rules_and_duplicate_entries(self):
        root = self.make_bundle()
        (root / "AGENTS.md").write_text("injected rules", encoding="utf-8")
        with self.assertRaises(ValueError):
            reader.verify_bundle(root)
        (root / "AGENTS.md").unlink()
        manifest = json.loads((root / "manifest.json").read_text())
        manifest["entries"] *= 2
        (root / "manifest.json").write_text(json.dumps(manifest))
        with self.assertRaises(ValueError):
            reader.verify_bundle(root)

    def test_bundle_script_relocation_independent_of_cwd(self):
        root = self.make_bundle()
        skill = self.base / "迁移 空格"
        skill.mkdir()
        root.rename(skill / "knowledge")
        scripts = skill / "scripts"
        scripts.mkdir()
        moved = scripts / "knowledge_reader.py"
        moved.write_bytes(SCRIPT.read_bytes())
        result = subprocess.run([sys.executable, "-B", str(moved), "search", "fileId"], cwd=self.root, capture_output=True, encoding="utf-8", check=True)
        data = json.loads(result.stdout)
        self.assertEqual(data["results"][0]["source_id"], "file-id.md")
        self.assertEqual(data["source_scope"], "bundled-knowledge")
        self.assertEqual(data["bundle_integrity"], "integrity-checked")
        self.assertNotIn(str(self.base), result.stdout)

    def test_manifest_cannot_list_rule_file_as_knowledge(self):
        root = self.make_bundle()
        manifest = json.loads((root / "manifest.json").read_text())
        for name, identity in [("agents.md", "agents"), ("CLAUDE.md", "claude"), ("skill.md", "skill"), ("file-id.md", "mismatched")]:
            with self.subTest(name=name):
                manifest["entries"][0].update(file=name, id=identity)
                (root / "manifest.json").write_text(json.dumps(manifest))
                with self.assertRaises(ValueError):
                    reader.verify_bundle(root)

    def test_null_manifest_returns_json_without_traceback(self):
        root = self.make_bundle()
        (root / "manifest.json").write_text("null")
        result = subprocess.run([sys.executable, "-B", str(SCRIPT), "--root", str(root), "verify-bundle"], capture_output=True, encoding="utf-8")
        self.assertEqual(result.returncode, 1)
        self.assertIn("error", json.loads(result.stdout))
        self.assertEqual(result.stderr, "")
        self.assertNotIn(str(self.base), result.stdout)


if __name__ == "__main__":
    unittest.main()

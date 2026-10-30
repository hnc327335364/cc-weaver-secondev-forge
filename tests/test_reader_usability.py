"""验证紧凑CLI不丢正文，以及元数据检索不会冒充全文检索。"""
import json
import subprocess
import sys
import unittest
from pathlib import Path
from unittest import mock

import test_library_reader as fixtures


SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"


class ReaderUsabilityTests(unittest.TestCase):
    def setUp(self):
        self.fixture = fixtures.LibraryReaderTests(methodName="runTest")
        self.fixture.setUp()
        self.addCleanup(self.fixture.doCleanups)
        self.root = self.fixture.root

    def cli(self, script, *args):
        result = subprocess.run([sys.executable, "-B", str(SCRIPTS / script), "--root", str(self.root), *args],
                                capture_output=True, encoding="utf-8", check=True)
        return json.loads(result.stdout)

    def test_metadata_never_reads_objects_in_both_catalog_formats(self):
        self.fixture.reopen()
        self.fixture.add("hr", "只有正文出现 BODY_ONLY_MARKER\n", "E10/HR 集成.md", "E10")
        self.fixture.finish()
        for schema in (1, 2):
            if schema == 2:
                self.fixture.compact()
            with self.subTest(schema=schema), fixtures.reader.Library(self.root) as library:
                with mock.patch.object(library, "object", side_effect=AssertionError("不应打开正文")):
                    result = library.search("HR 集成", platform="E10", scope="metadata")
                    self.assertEqual([item["document_id"] for item in result["results"]], ["hr"])
                    self.assertEqual(result["scope"], "metadata")
                    self.assertFalse(result["body_searched"])
                    self.assertIn("body-not-searched", result["search_scope"])
                    self.assertIsNone(result["results"][0]["snippet"])
                    self.assertIsNone(result["results"][0]["first_match_line"])
                    self.assertEqual(result["results"][0]["object_integrity"], "checked-on-read-or-verify")
                    empty = library.search("BODY_ONLY_MARKER", scope="metadata")
                    self.assertEqual(empty["matched_documents"], 0)
                    self.assertFalse(empty["body_searched"])
                self.assertEqual(library.search("BODY_ONLY_MARKER")["matched_documents"], 1)

    def test_metadata_preserves_literal_filters_and_pagination(self):
        self.fixture.reopen()
        self.fixture.add("hr1", "first\n", "E10/HR 集成 100%_value.md", "E10")
        self.fixture.add("hr2", "second\n", "E10/HR 集成_2.md", "E10", source="local")
        self.fixture.add("hr9", "E9 only\n", "E9/HR 集成.md", "E9")
        self.fixture.finish()
        with fixtures.reader.Library(self.root) as library:
            first = library.search("HR 集成", platform="E10", scope="metadata", limit=1)
            self.assertEqual(first["matched_documents"], 2)
            self.assertEqual(first["next_offset"], 1)
            second = library.search("HR 集成", platform="E10", scope="metadata", limit=1, offset=1)
            self.assertNotEqual(first["results"][0]["document_id"], second["results"][0]["document_id"])
            self.assertIsNone(second["next_offset"])
            selected = library.search("HR 集成", source="local", scope="metadata")
            self.assertEqual([item["document_id"] for item in selected["results"]], ["hr2"])
            self.assertEqual(library.search("100%_value", scope="metadata")["matched_documents"], 1)
            self.assertEqual(library.search("' OR 1=1", scope="metadata")["matched_documents"], 0)
            # 连写无命中时保留字面语义，由调用方明确拆词，不自动改写技术标识。
            self.assertEqual(library.search("HR集成", scope="metadata")["matched_documents"], 0)

    def test_default_full_search_and_python_read_remain_compatible(self):
        with fixtures.reader.Library(self.root) as library:
            self.assertEqual(library.search("triggerActionFlow"), library.search("triggerActionFlow", scope="full"))
            self.assertIn("lines", library.read("form"))
            with self.assertRaises(ValueError):
                library.search("anything", scope="unknown")

    def test_compact_clis_only_remove_duplicate_lines(self):
        for script, command in (("library_reader.py", ("read", "form")),
                                ("knowledge_lookup.py", ("source", "E9/表单.md"))):
            with self.subTest(script=script):
                normal = self.cli(script, *command, "--lines", "1")
                compact = self.cli(script, *command, "--lines", "1", "--compact")
                self.assertIn("lines", normal)
                normal.pop("lines")
                self.assertEqual(compact, normal)
                self.assertTrue(compact["truncated"])
                self.assertEqual(compact["next_line"], 2)
                self.assertEqual(len(compact["document"]["output_sha256"]), 64)
                self.assertEqual(len(compact["document"]["source_sha256"]), 64)

    def test_compact_continuation_keeps_unicode_and_line_boundaries(self):
        body = "段首\n" + "中文😀ABC" * 13 + "\n尾部\n"
        self.fixture.reopen()
        self.fixture.add("long", body, "E10/长行.jsonl", "E10")
        self.fixture.finish()
        self.fixture.compact()
        for script, command in (("library_reader.py", ("read", "long")),
                                ("knowledge_lookup.py", ("source", "E10/长行.jsonl"))):
            with self.subTest(script=script):
                chunks, line, column = [], 1, 0
                while line is not None:
                    result = self.cli(script, *command, "--start", str(line), "--column", str(column),
                                      "--lines", "2", "--chars", "19", "--compact")
                    self.assertNotIn("lines", result)
                    if chunks and column == 0:
                        chunks.append("\n")
                    chunks.append(result["text"])
                    self.assertEqual(result["truncated"], result["next_line"] is not None)
                    line, column = result["next_line"], result["next_column"]
                self.assertEqual("".join(chunks), "\n".join(body.splitlines()))

    def test_compact_binary_keeps_attachment_boundary(self):
        normal = self.cli("library_reader.py", "read", "binary")
        compact = self.cli("library_reader.py", "read", "binary", "--compact")
        self.assertEqual(compact, normal)
        self.assertFalse(compact["readable_text"])
        self.assertNotIn("text", compact)

    def test_metadata_cli_is_explicit_about_unsearched_body(self):
        result = self.cli("library_reader.py", "search", "triggerActionFlow", "--scope", "metadata")
        self.assertEqual(result["matched_documents"], 0)
        self.assertFalse(result["body_searched"])
        self.assertEqual(result["scope"], "metadata")

    def test_read_help_states_actual_page_limits_and_continuation(self):
        for script, command in (("library_reader.py", "read"), ("knowledge_lookup.py", "source")):
            with self.subTest(script=script):
                result = subprocess.run([sys.executable, "-B", str(SCRIPTS / script), command, "--help"],
                                        capture_output=True, encoding="utf-8", check=True)
                for required in ("1至200行", "1至20000字符", "next_line", "next_column", "Unicode"):
                    self.assertIn(required, result.stdout)


if __name__ == "__main__":
    unittest.main()

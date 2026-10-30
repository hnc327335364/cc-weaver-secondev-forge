import hashlib
import importlib.util
import json
import os
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "library_reader.py"
SPEC = importlib.util.spec_from_file_location("library_reader", SCRIPT)
reader = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(reader)


class LibraryReaderTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="cc-library-reader-")
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name).resolve()
        self.root = self.base / "中文 资料"
        self.root.mkdir()
        self.db = sqlite3.connect(self.root / "catalog.sqlite")
        self.db.execute("CREATE TABLE sources(id TEXT PRIMARY KEY,label TEXT,version TEXT,root_path TEXT)")
        self.db.execute("INSERT INTO sources VALUES('hq','平台开发资料','1.3.4','归档/平台开发资料')")
        self.db.execute("INSERT INTO sources VALUES('local','现有知识库','2026-10-22','本地资料')")
        self.db.execute("CREATE TABLE documents(id TEXT PRIMARY KEY,source_id TEXT,source_path TEXT,"
                        "source_version TEXT,title TEXT,platform TEXT,kind TEXT,media_type TEXT,object_path TEXT,"
                        "source_sha256 TEXT,output_sha256 TEXT,source_bytes INTEGER,output_bytes INTEGER,"
                        "encoding TEXT,line_count INTEGER,text TEXT,safety_changes TEXT)")
        self.add("form", "# 流程表单\nWfForm.registerCheckEvent 绑定事件\n中文表单\n", "E9/表单.md", "E9")
        self.add("dictionary", '{"table":"workflow_requestbase","fields":["requestid"]}\n',
                 "E9/字典.json", "E9", media="application/json")
        self.add("action", '# 动作流\n调用 triggerActionFlow 检查流程\n', "E10/动作流.md", "E10")
        self.add("local", '# 现场限制\n调用 triggerActionFlow 需核实版本\n', "E10/现场说明.md", "E10", source="local")
        self.add("code", 'print("绝不执行来源脚本")\n', "E9/tool.py", "E9", kind="reference-code")
        self.add("binary", b"\x89PNG\x00\xff\x01", "E9/截图.png", "E9", media="image/png")
        self.finish()

    def add(self, identity, text, source_path, platform, source="hq", media="text/plain", kind="reference-document"):
        binary = isinstance(text, bytes)
        body = text if binary else text.encode("utf-8")
        checksum = hashlib.sha256(body).hexdigest()
        suffix = "bin" if binary else "txt"
        relative = f"objects/{checksum[:2]}/{checksum}.{suffix}"
        path = self.root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(body)
        lines = 0 if binary else text.count("\n") + int(bool(text) and not text.endswith("\n"))
        self.db.execute("INSERT INTO documents VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", (
            identity, source, source_path, "1.3.4" if source == "hq" else "2026-10-22", Path(source_path).stem,
            platform, kind, media, relative, checksum, checksum, len(body), len(body),
            None if binary else "utf-8", lines, None if binary else text, "[]"))
        return path

    def finish(self):
        self.db.commit()
        self.db.close()
        self.rehash()

    def rehash(self):
        checksum = hashlib.sha256((self.root / "catalog.sqlite").read_bytes()).hexdigest()
        (self.root / "manifest.json").write_text(json.dumps({"schema_version": 1, "catalog_sha256": checksum}), encoding="utf-8")

    def reopen(self):
        self.db = sqlite3.connect(self.root / "catalog.sqlite")

    def object_path(self, identity):
        with sqlite3.connect(self.root / "catalog.sqlite") as db:
            relative = db.execute("SELECT object_path FROM documents WHERE id=?", (identity,)).fetchone()[0]
        return self.root / relative

    def full_manifest(self):
        manifest = json.loads((self.root / "manifest.json").read_text(encoding="utf-8"))
        with sqlite3.connect(self.root / "catalog.sqlite") as db:
            db.row_factory = sqlite3.Row
            records = [dict(row) for row in db.execute("SELECT " + ",".join(reader.DOC_FIELDS) + " FROM documents")]
        objects = {item["object_path"]: item["output_bytes"] for item in records}
        manifest["files"] = records
        manifest["summary"] = {"source_records": len(records), "unique_objects": len(objects),
                               "source_bytes": sum(item["source_bytes"] for item in records),
                               "output_bytes": sum(objects.values()),
                               "text_records": sum(item["encoding"] is not None for item in records),
                               "attachment_records": sum(item["encoding"] is None for item in records)}
        return manifest

    def save_manifest(self, manifest):
        (self.root / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False), encoding="utf-8")

    def compact(self):
        summary = self.full_manifest()["summary"]
        summary.update(original_file_records=summary["source_records"], derived_records=0, excluded_records=0)
        self.reopen()
        self.db.execute("UPDATE documents SET text=NULL")
        self.db.execute("PRAGMA user_version=2")
        self.finish()
        manifest = json.loads((self.root / "manifest.json").read_text(encoding="utf-8"))
        manifest.update(schema_version=2, summary=summary)
        self.save_manifest(manifest)

    def derived_manifest(self):
        self.reopen()
        self.add("html-original", "<h1>字典</h1><p>workflow_requestbase</p>", "E9/数据字典.html", "E9", kind="reference-code")
        self.add("html-derived", "# 字典\nworkflow_requestbase\n", "E9/数据字典.html!derived/text", "E9", kind="derived-html-text")
        self.db.execute("UPDATE documents SET source_bytes=(SELECT source_bytes FROM documents WHERE id='html-original'),"
                        "source_sha256=(SELECT source_sha256 FROM documents WHERE id='html-original') WHERE id='html-derived'")
        self.finish()
        manifest = self.full_manifest()
        original = next(item for item in manifest["files"] if item["id"] == "html-original")
        derived = next(item for item in manifest["files"] if item["id"] == "html-derived")
        original["derived_text_id"] = "html-derived"
        derived.update(is_derived=True, derived_from_id="html-original")
        manifest["summary"].update(original_file_records=7, derived_records=1)
        manifest["summary"]["source_bytes"] -= derived["source_bytes"]
        return manifest

    def test_stats_counts_text_and_binary_sources(self):
        with reader.Library(self.root) as library:
            result = library.stats()
        self.assertEqual(result["documents"], 6)
        self.assertEqual(result["text_documents"], 5)
        self.assertEqual(result["sources"][0]["version"], "1.3.4")
        self.assertEqual(result["original_file_records"], 6)
        self.assertEqual(result["derived_records"], 0)

    def test_search_reads_json_and_returns_real_body_snippet(self):
        with reader.Library(self.root) as library:
            result = library.search("workflow_requestbase requestid", platform="E9")
            hit = result["results"][0]
            self.assertEqual(result["matched_documents"], 1)
            self.assertEqual(hit["document_id"], "dictionary")
            self.assertEqual(hit["first_match_line"], 1)
            self.assertIn('"requestid"', hit["snippet"])
            self.assertEqual(hit["match_scope"], "body")

    def test_platform_source_and_pagination_filters(self):
        with reader.Library(self.root) as library:
            result = library.search("triggerActionFlow", limit=1)
            self.assertEqual(result["matched_documents"], 2)
            self.assertEqual(result["next_offset"], 1)
            next_page = library.search("triggerActionFlow", limit=1, offset=1)
            self.assertNotEqual(result["results"][0]["document_id"], next_page["results"][0]["document_id"])
            self.assertEqual(library.search("triggerActionFlow", source="hq")["matched_documents"], 1)
            self.assertEqual(library.search("triggerActionFlow", platform="e9")["matched_documents"], 0)
            self.assertEqual(library.list(platform="e10")["matched_documents"], 2)

    def test_title_only_hit_is_not_claimed_body_match(self):
        with reader.Library(self.root) as library:
            hit = library.search("tool.py")["results"][0]
        self.assertEqual(hit["match_scope"], "title-or-source-path-only")
        self.assertIsNone(hit["snippet"])
        self.assertIsNone(hit["first_match_line"])

    def test_search_is_literal_and_resists_sql_injection(self):
        self.reopen()
        self.add("literal", "100%_value ' OR 1=1\n", "literal.txt", "E9")
        self.finish()
        with reader.Library(self.root) as library:
            self.assertEqual(library.search("100%_value")["matched_documents"], 1)
            self.assertEqual(library.search("' OR 1=1")["matched_documents"], 1)
            self.assertEqual(library.search("unknown%_")["matched_documents"], 0)

    def test_search_after_four_mib_and_read_jsonl_by_line(self):
        self.reopen()
        body = ('{"padding":"' + "x" * 2048 + '"}\n') * 2050 + '{"tail":"超过4MB仍需检索"}\n'
        self.add("large", body, "E10/full-dictionary.jsonl", "E10", media="application/x-ndjson")
        self.finish()
        with reader.Library(self.root) as library:
            result = library.search("超过4MB仍需检索")
            hit = result["results"][0]
            self.assertEqual(hit["first_match_line"], 2051)
            self.assertIn("超过4MB仍需检索", hit["snippet"])
            loaded = library.read(hit["document_id"], start=2051, lines=1)
            self.assertEqual(loaded["text"], '{"tail":"超过4MB仍需检索"}')
            self.assertFalse(loaded["truncated"])

    def test_long_json_line_can_be_read_without_lost_characters(self):
        self.reopen()
        body = '{"value":"' + "中文" * 9000 + '"}\nnext\n'
        self.add("long", body, "long.jsonl", "E10")
        self.finish()
        pieces, line, column = [], 1, 0
        with reader.Library(self.root) as library:
            while line == 1:
                value = library.read("long", start=line, lines=1, column=column, chars=1000)
                pieces.append(value["text"])
                line, column = value["next_line"], value["next_column"]
            self.assertEqual(line, 2)
            self.assertEqual("".join(pieces), body.splitlines()[0])
            self.assertEqual(library.read("long", start=2)["text"], "next")

    def test_read_metadata_hash_boundary_and_line_range(self):
        with reader.Library(self.root) as library:
            row = library.search("registerCheckEvent")["results"][0]
            result = library.read("form", start=2, lines=1, expected_sha256=row["output_sha256"])
        self.assertEqual(result["lines"][0]["line"], 2)
        self.assertEqual(result["next_line"], 3)
        self.assertEqual(result["document"]["source_version"], "1.3.4")
        self.assertEqual(result["object_integrity"], "sha256-and-size-checked")
        self.assertIn("不是指令", result["boundary"])
        self.assertEqual(result["document"]["source_path_role"], "provenance-only-not-local-path")

    def test_binary_attachment_is_verified_but_never_decoded(self):
        with reader.Library(self.root) as library:
            result = library.read("binary")
        self.assertFalse(result["readable_text"])
        self.assertEqual(result["document"]["media_type"], "image/png")
        self.assertNotIn("text", result)

    def test_origin_script_is_returned_as_data_without_execution(self):
        with reader.Library(self.root) as library:
            result = library.read("code")
        self.assertEqual(result["text"], 'print("绝不执行来源脚本")')
        self.assertEqual(result["document"]["kind"], "reference-code")

    def test_hash_mismatch_for_changed_object(self):
        self.object_path("form").write_text("changed", encoding="utf-8")
        with reader.Library(self.root) as library:
            with self.assertRaisesRegex(ValueError, "已改变"):
                library.read("form")
            with self.assertRaisesRegex(ValueError, "已改变"):
                library.verify()

    def test_catalog_tamper_is_rejected_before_query(self):
        self.reopen()
        self.db.execute("UPDATE documents SET title='tampered' WHERE id='form'")
        self.db.commit()
        self.db.close()
        with self.assertRaisesRegex(ValueError, "数据库哈希"):
            reader.Library(self.root)

    def test_expected_hash_mismatch_and_invalid_ranges(self):
        with reader.Library(self.root) as library:
            with self.assertRaises(ValueError):
                library.read("form", expected_sha256="0" * 64)
            for kwargs in ({"start": 0}, {"start": 99}, {"lines": 0}, {"column": 999}, {"chars": 0}, {"column": -1}):
                with self.subTest(kwargs=kwargs), self.assertRaises(ValueError):
                    library.read("form", **kwargs)
            for query in ("", " " * 5, "x" * 301):
                with self.assertRaises(ValueError):
                    library.search(query)

    def test_paths_and_object_filename_are_validated(self):
        for path in ("../secret", "/etc/passwd", "C:/secret", "x\\y", "objects//x", "objects/../secret"):
            with self.subTest(path=path), self.assertRaises(ValueError):
                reader.safe_path(self.root, path)
        self.reopen()
        self.db.execute("UPDATE documents SET object_path='../secret' WHERE id='form'")
        self.finish()
        with reader.Library(self.root) as library:
            with self.assertRaisesRegex(ValueError, "对象路径"):
                library.read("form")

    def test_symlink_object_and_root_are_rejected(self):
        original = self.object_path("form")
        outside = self.base / "outside.txt"
        outside.write_bytes(original.read_bytes())
        original.unlink()
        try:
            original.symlink_to(outside)
            linked_root = self.base / "linked"
            linked_root.symlink_to(self.root, target_is_directory=True)
        except (OSError, NotImplementedError):
            self.skipTest("此环境不支持创建符号链接；链接用例未执行")
        with reader.Library(self.root) as library:
            with self.assertRaisesRegex(ValueError, "符号链接"):
                library.read("form")
        with self.assertRaisesRegex(ValueError, "符号链接"):
            reader.Library(linked_root)

    def test_related_candidates_have_real_readable_document_ids(self):
        with reader.Library(self.root) as library:
            result = library.related("form")
            self.assertTrue(result["results"])
            self.assertIn("not-validated-hyperlink", result["relation"])
            for item in result["results"]:
                library.read(item["document_id"])

    def test_empty_text_is_valid_and_missing_document_fails(self):
        self.reopen()
        self.add("empty", "", "empty.md", "E9")
        self.finish()
        with reader.Library(self.root) as library:
            result = library.read("empty")
            self.assertEqual(result["text"], "")
            self.assertFalse(result["truncated"])
            with self.assertRaises(ValueError):
                library.read("not-found")

    def test_verify_deduplicates_objects_and_is_read_only(self):
        self.reopen()
        self.add("duplicate", "# 流程表单\nWfForm.registerCheckEvent 绑定事件\n中文表单\n", "另一个来源/表单.md", "E9")
        self.finish()
        before = {path.relative_to(self.root).as_posix(): path.read_bytes() for path in self.root.rglob("*") if path.is_file()}
        with reader.Library(self.root) as library:
            result = library.verify()
            with self.assertRaises(sqlite3.OperationalError):
                library.db.execute("DELETE FROM documents")
        after = {path.relative_to(self.root).as_posix(): path.read_bytes() for path in self.root.rglob("*") if path.is_file()}
        self.assertEqual(result["checked_documents"], 7)
        self.assertEqual(result["checked_unique_objects"], 6)
        self.assertEqual(before, after)

    def test_cli_relocation_utf8_and_no_absolute_path_dependency(self):
        skill = self.base / "换电脑 中文 空格"
        (skill / "scripts").mkdir(parents=True)
        shutil.copytree(self.root, skill / "library")
        shutil.copyfile(SCRIPT, skill / "scripts" / "library_reader.py")
        result = subprocess.run([sys.executable, "-B", str(skill / "scripts" / "library_reader.py"),
                                 "search", "中文表单"], cwd=self.base,
                                env=dict(os.environ, PYTHONIOENCODING="cp1252"),
                                capture_output=True, encoding="utf-8", check=True)
        output = json.loads(result.stdout)
        self.assertEqual(output["results"][0]["document_id"], "form")
        self.assertNotIn(str(self.base), result.stdout)

    def test_cli_invalid_manifest_is_json_error_without_traceback(self):
        (self.root / "manifest.json").write_text("null", encoding="utf-8")
        result = subprocess.run([sys.executable, "-B", str(SCRIPT), "--root", str(self.root), "stats"],
                                capture_output=True, encoding="utf-8")
        self.assertEqual(result.returncode, 1)
        self.assertIn("error", json.loads(result.stdout))
        self.assertEqual(result.stderr, "")
        self.assertNotIn(str(self.base), result.stdout)

    def test_public_verify_api_checks_full_manifest(self):
        self.save_manifest(self.full_manifest())
        self.assertEqual(reader.verify(self.root)["checked_documents"], 6)

    def test_manifest_record_mismatch_is_rejected(self):
        manifest = self.full_manifest()
        manifest["files"][0]["source_path"] = "伪造来源.md"
        self.save_manifest(manifest)
        with self.assertRaisesRegex(ValueError, "来源记录"):
            reader.verify(self.root)

    def test_manifest_summary_and_missing_records_are_rejected(self):
        original = self.full_manifest()
        for change in (lambda m: m["summary"].update(source_records=900), lambda m: m["files"].pop()):
            manifest = json.loads(json.dumps(original))
            change(manifest)
            self.save_manifest(manifest)
            with self.assertRaises(ValueError):
                reader.verify(self.root)

    def test_readable_page_mapping_is_returned_and_verified(self):
        manifest = self.full_manifest()
        page = self.root / "pages" / "form.md"
        page.parent.mkdir()
        page.write_text("# 表单\n这是完整正文副本\n", encoding="utf-8")
        entry = next(item for item in manifest["files"] if item["id"] == "form")
        entry.update(page_path="pages/form.md", page_sha256=hashlib.sha256(page.read_bytes()).hexdigest())
        self.save_manifest(manifest)
        with reader.Library(self.root) as library:
            self.assertEqual(library.search("registerCheckEvent")["results"][0]["view_path"], "pages/form.md")
            self.assertEqual(library.read("form")["document"]["view_path"], "pages/form.md")
            self.assertEqual(library.verify()["checked_readable_pages"], 1)
        page.write_text("changed", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "正文页哈希"):
            reader.verify(self.root)

    def test_readable_page_path_escape_is_rejected(self):
        manifest = self.full_manifest()
        next(item for item in manifest["files"] if item["id"] == "form").update(
            page_path="../outside.md", page_sha256="0" * 64)
        self.save_manifest(manifest)
        with reader.Library(self.root) as library:
            with self.assertRaisesRegex(ValueError, "越出"):
                library.read("form")

    def test_html_derived_stats_do_not_double_count_original_files_or_bytes(self):
        manifest = self.derived_manifest()
        self.save_manifest(manifest)
        with reader.Library(self.root) as library:
            stats = library.stats()
            self.assertEqual(stats["documents"], 8)
            self.assertEqual(stats["original_file_records"], 7)
            self.assertEqual(stats["derived_records"], 1)
            self.assertEqual(stats["source_bytes"], manifest["summary"]["source_bytes"])
            hq = next(item for item in stats["sources"] if item["id"] == "hq")
            self.assertEqual(hq["documents"], 7)
            self.assertEqual(hq["original_file_records"], 6)
            self.assertEqual(hq["derived_records"], 1)
            original = library.read("html-original")["document"]
            derived = library.read("html-derived")["document"]
            self.assertFalse(original["is_derived"])
            self.assertEqual(original["derived_text_id"], "html-derived")
            self.assertTrue(derived["is_derived"])
            self.assertEqual(derived["derived_from_id"], "html-original")

    def test_html_derived_verify_uses_original_only_source_bytes(self):
        manifest = self.derived_manifest()
        self.save_manifest(manifest)
        verified = reader.verify(self.root)
        self.assertEqual(verified["checked_documents"], 8)
        self.assertEqual(verified["checked_original_files"], 7)
        self.assertEqual(verified["checked_derived_records"], 1)
        self.assertEqual(verified["checked_source_bytes"], manifest["summary"]["source_bytes"])
        manifest["summary"]["source_bytes"] += next(item for item in manifest["files"] if item.get("is_derived"))["source_bytes"]
        self.save_manifest(manifest)
        with self.assertRaisesRegex(ValueError, "汇总数量"):
            reader.verify(self.root)

    def test_derived_record_requires_valid_original_reference(self):
        manifest = self.derived_manifest()
        entry = next(item for item in manifest["files"] if item["id"] == "html-derived")
        entry["derived_from_id"] = "missing-original"
        self.save_manifest(manifest)
        with self.assertRaisesRegex(ValueError, "原始文件"):
            reader.verify(self.root)

    def test_derived_count_and_flag_must_be_consistent(self):
        manifest = self.derived_manifest()
        manifest["summary"]["derived_records"] = 2
        self.save_manifest(manifest)
        with self.assertRaisesRegex(ValueError, "汇总数量"):
            reader.verify(self.root)
        entry = next(item for item in manifest["files"] if item["id"] == "html-derived")
        entry["is_derived"] = "true"
        self.save_manifest(manifest)
        with self.assertRaisesRegex(ValueError, "布尔值"):
            reader.verify(self.root)

    def test_exact_title_with_body_precedes_general_index_and_metadata_only(self):
        self.reopen()
        self.add("general-index", "# 总索引\nworkflow_requestbase\n", "E9/00-index.md", "E9")
        self.add("table-body", "# workflow_requestbase\nrequestid 字段定义\n", "E9/z/workflow_requestbase.md", "E9")
        self.add("title-only", "只有导航占位，没有正文内容\n", "E9/a/workflow_requestbase.md", "E9")
        self.finish()
        with reader.Library(self.root) as library:
            result = library.search("workflow_requestbase", platform="E9", limit=100)
            ids = [item["document_id"] for item in result["results"]]
            self.assertEqual(ids[0], "table-body")
            self.assertLess(ids.index("general-index"), ids.index("title-only"))
            self.assertTrue(result["results"][0]["title_matches_all_terms"])
            self.assertEqual(result["results"][0]["match_scope"], "body")
            self.assertIn("not-authority-or-version-order", result["ranking"])

    def test_title_priority_requires_every_query_term(self):
        self.reopen()
        body = "workflow_requestbase requestid 的字段说明\n"
        self.add("partial-title", body, "E9/a/workflow_requestbase.md", "E9")
        self.add("full-title", body, "E9/z/workflow_requestbase requestid.md", "E9")
        self.finish()
        with reader.Library(self.root) as library:
            result = library.search("workflow_requestbase requestid", platform="E9", limit=100)
            self.assertEqual(result["results"][0]["document_id"], "full-title")
            partial = next(item for item in result["results"] if item["document_id"] == "partial-title")
            self.assertFalse(partial["title_matches_all_terms"])

    def test_html_derived_is_before_its_original_without_hiding_either(self):
        manifest = self.derived_manifest()
        self.save_manifest(manifest)
        with reader.Library(self.root) as library:
            result = library.search("workflow_requestbase", platform="E9", limit=100)
            ids = [item["document_id"] for item in result["results"]]
            self.assertIn("html-original", ids)
            self.assertIn("html-derived", ids)
            self.assertLess(ids.index("html-derived"), ids.index("html-original"))
            self.assertIn("<h1>", library.read("html-original")["text"])
            self.assertIn("# 字典", library.read("html-derived")["text"])

    def test_compact_stats_read_list_verify_without_manifest_record_copies(self):
        self.compact()
        with reader.Library(self.root) as library:
            self.assertNotIn("files", library.manifest)
            self.assertEqual(library.stats()["text_documents"], 5)
            self.assertEqual(library.stats()["derived_records"], 0)
            self.assertEqual(library.list(platform="E10")["matched_documents"], 2)
            self.assertIn("registerCheckEvent", library.read("form")["text"])
            self.assertFalse(library.read("binary")["readable_text"])
            self.assertEqual(library.read("code")["text"], 'print("绝不执行来源脚本")')
            self.assertEqual(library.verify()["checked_unique_objects"], 6)

    def test_compact_summary_cannot_be_missing_null_or_non_object(self):
        self.compact()
        valid = json.loads((self.root / "manifest.json").read_text())
        missing = dict(valid)
        missing.pop("summary")
        candidates = [missing, *[dict(valid, summary=value) for value in (None, [], "6", 6, True)]]
        for manifest in candidates:
            with self.subTest(summary=manifest.get("summary")):
                self.save_manifest(manifest)
                with self.assertRaisesRegex(ValueError, "汇总数量"):
                    reader.Library(self.root)

    def test_compact_all_count_fields_require_non_negative_integers_not_booleans(self):
        self.compact()
        valid = json.loads((self.root / "manifest.json").read_text())
        for field in reader.COMPACT_COUNTS:
            for value in (None, "1", 1.0, True, False, -1, [], {}):
                manifest = json.loads(json.dumps(valid))
                manifest["summary"][field] = value
                self.save_manifest(manifest)
                with self.subTest(field=field, value=value), self.assertRaisesRegex(ValueError, "汇总数量"):
                    reader.Library(self.root)
            manifest = json.loads(json.dumps(valid))
            manifest["summary"].pop(field)
            self.save_manifest(manifest)
            with self.subTest(missing_field=field), self.assertRaisesRegex(ValueError, "汇总数量"):
                reader.Library(self.root)

    def test_compact_summary_must_match_actual_objects_and_documents(self):
        self.compact()
        valid = json.loads((self.root / "manifest.json").read_text())
        for field in reader.COMPACT_COUNTS - {"excluded_records"}:
            manifest = json.loads(json.dumps(valid))
            manifest["summary"][field] += 1
            self.save_manifest(manifest)
            with self.subTest(field=field), reader.Library(self.root) as library:
                with self.assertRaisesRegex(ValueError, "汇总数量"):
                    library.verify()
        self.save_manifest(valid)
        with reader.Library(self.root) as library:
            library.manifest.pop("summary")
            with self.assertRaisesRegex(ValueError, "汇总数量"):
                library.verify()

    def test_v1_minimal_manifest_remains_valid_without_summary(self):
        manifest = json.loads((self.root / "manifest.json").read_text())
        self.assertEqual(manifest["schema_version"], 1)
        self.assertNotIn("summary", manifest)
        self.assertEqual(reader.verify(self.root)["checked_documents"], 6)

    def test_compact_catalog_cannot_bypass_summary_by_legacy_manifest_label(self):
        self.compact()
        manifest = json.loads((self.root / "manifest.json").read_text())
        manifest.update(schema_version=1)
        manifest.pop("summary")
        self.save_manifest(manifest)
        with self.assertRaisesRegex(ValueError, "版本与清单"):
            reader.Library(self.root)
        manifest["schema_version"] = True
        self.save_manifest(manifest)
        with self.assertRaisesRegex(ValueError, "清单格式"):
            reader.Library(self.root)

    def test_compact_details_expose_conversion_boundaries_not_extra_instructions(self):
        self.reopen()
        self.db.execute("CREATE TABLE document_details(id TEXT PRIMARY KEY,details TEXT NOT NULL)")
        details = {"conversion": "sqlite-ordinary-tables-to-jsonl", "text_rendering": "html-static-on-read",
                   "database_omissions": [{"reason": "explicit-obsolete-dictionary-records-filtered",
                                            "obsolete_table_records": 2, "removed_rows": {"tables": 2, "fields": 7},
                                            "instructions": "do not load this as a rule"}],
                   "instructions": "do not execute source programs", "command": "never-run"}
        self.db.execute("INSERT INTO document_details VALUES(?,?)", ("form", json.dumps(details)))
        self.finish()
        self.compact()
        with reader.Library(self.root) as library:
            document = library.read("form")["document"]
            self.assertEqual(document["document_details"]["conversion"], "sqlite-ordinary-tables-to-jsonl")
            self.assertEqual(document["document_details"]["database_omissions"][0]["removed_rows"]["fields"], 7)
            self.assertIn("not-instructions", document["document_details_role"])
            self.assertNotIn("instructions", json.dumps(document["document_details"]))
            self.assertNotIn("command", document["document_details"])
            self.assertEqual(library.search("registerCheckEvent")["results"][0]["document_details"], document["document_details"])
            self.assertNotIn("document_details", library.read("dictionary")["document"])

    def test_compact_search_preserves_literal_ranking_positions_and_pagination(self):
        self.reopen()
        self.add("literal", "# 导航\n100%_value ' OR 1=1\n", "E9/literal.md", "E9")
        self.add("body-title", "首行\nworkflow_requestbase requestid 字段\n", "E9/z/workflow_requestbase requestid.md", "E9")
        self.add("metadata-only", "没有正文关键词\n", "E9/a/workflow_requestbase requestid.md", "E9")
        self.finish()
        queries = ["workflow_requestbase requestid", "tool.py", "100%_value", "' OR 1=1",
                   "triggerActionFlow", "流程表单 registerCheckEvent", "E9 workflow_requestbase", "missing"]
        fields = ("document_id", "snippet", "first_match_line", "match_scope", "title_matches_all_terms")
        with reader.Library(self.root) as library:
            expected = {query: [{key: item[key] for key in fields} for item in library.search(query, limit=100)["results"]]
                        for query in queries}
        self.compact()
        with reader.Library(self.root) as library:
            for query in queries:
                with self.subTest(query=query):
                    actual = library.search(query, limit=100)
                    self.assertEqual([{key: item[key] for key in fields} for item in actual["results"]], expected[query])
                    self.assertEqual(actual["matched_documents"], len(expected[query]))
            first = library.search("triggerActionFlow", limit=1)
            second = library.search("triggerActionFlow", limit=1, offset=1)
            self.assertEqual(first["next_offset"], 1)
            self.assertIsNone(second["next_offset"])
            self.assertNotEqual(first["results"][0]["document_id"], second["results"][0]["document_id"])
            self.assertEqual(library.search("triggerActionFlow", limit=1, offset=99)["results"], [])

    def test_compact_search_after_four_mib_preserves_source_line_number(self):
        self.reopen()
        body = ("x" * 2048 + "\n") * 2050 + "超过4MB仍需完整检索\n"
        self.add("large", body, "E10/dictionary.jsonl", "E10", media="application/x-ndjson")
        self.finish()
        self.compact()
        with reader.Library(self.root) as library:
            hit = library.search("超过4MB仍需完整检索")["results"][0]
            self.assertEqual(hit["first_match_line"], 2051)
            self.assertEqual(hit["object_integrity"], "sha256-and-size-checked")
            self.assertEqual(library.read("large", start=hit["first_match_line"])["text"], "超过4MB仍需完整检索")

    def test_compact_search_reuses_same_object_only_within_this_query(self):
        self.reopen()
        self.add("duplicate", "# 流程表单\nWfForm.registerCheckEvent 绑定事件\n中文表单\n", "E9/重复来源.md", "E9")
        self.finish()
        self.compact()
        with reader.Library(self.root) as library, mock.patch.object(library, "object", wraps=library.object) as opened:
            result = library.search("registerCheckEvent", platform="E9")
            self.assertEqual(result["matched_documents"], 2)
            self.assertEqual(opened.call_count, 3)
            self.object_path("form").write_text("changed", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "已改变"):
                library.search("registerCheckEvent", platform="E9")

    def test_compact_search_applies_platform_and_source_before_object_access(self):
        self.compact()
        self.object_path("action").write_text("changed", encoding="utf-8")
        with reader.Library(self.root) as library:
            self.assertEqual(library.search("registerCheckEvent", platform="E9")["matched_documents"], 1)
            self.assertEqual(library.search("triggerActionFlow", source="local")["matched_documents"], 1)
            with self.assertRaisesRegex(ValueError, "已改变"):
                library.search("triggerActionFlow")

    def test_compact_search_rejects_path_escape(self):
        self.reopen()
        self.db.execute("UPDATE documents SET object_path='../secret' WHERE id='form'")
        self.finish()
        self.compact()
        with reader.Library(self.root) as library:
            with self.assertRaisesRegex(ValueError, "对象路径"):
                library.search("registerCheckEvent", platform="E9")

    def test_compact_search_rejects_symbolic_link(self):
        self.compact()
        original = self.object_path("form")
        outside = self.base / "outside.txt"
        outside.write_bytes(original.read_bytes())
        original.unlink()
        try:
            original.symlink_to(outside)
        except (OSError, NotImplementedError):
            self.skipTest("此环境不支持创建符号链接；链接用例未执行")
        with reader.Library(self.root) as library:
            with self.assertRaisesRegex(ValueError, "符号链接"):
                library.search("registerCheckEvent", platform="E9")

    def test_compact_database_version_and_duplicate_body_are_rejected(self):
        self.compact()
        summary = json.loads((self.root / "manifest.json").read_text())["summary"]
        for statement in ("PRAGMA user_version=1", "UPDATE documents SET text='duplicated' WHERE id='form'"):
            self.reopen()
            self.db.execute("PRAGMA user_version=2")
            self.db.execute("UPDATE documents SET text=NULL")
            self.db.execute(statement)
            self.finish()
            manifest = json.loads((self.root / "manifest.json").read_text(encoding="utf-8"))
            manifest.update(schema_version=2, summary=summary)
            self.save_manifest(manifest)
            with self.subTest(statement=statement), self.assertRaises(ValueError):
                reader.Library(self.root)

    def test_compact_search_rejects_unknown_text_encoding(self):
        self.reopen()
        self.db.execute("UPDATE documents SET encoding='gb18030' WHERE id='form'")
        self.finish()
        self.compact()
        with reader.Library(self.root) as library:
            with self.assertRaisesRegex(ValueError, "文本编码"):
                library.search("registerCheckEvent")

    def test_readable_html_is_on_demand_and_never_executes_or_fetches(self):
        self.reopen()
        html = ('<html><head><style>HIDDEN_STYLE</style><script>HIDDEN_SCRIPT</script></head>'
                '<body><h1>流程字典</h1><table><tr><th>字段</th><th>说明</th></tr>'
                '<tr><td>requestid</td><td>流程 &amp; 请求</td></tr></table>'
                '<img alt="字段图" src="https://example.invalid/private.png">'
                '<template>HIDDEN_TEMPLATE</template><p>末行</p></body></html>')
        self.add("html", html, "E9/字典.html", "E9", media="text/html", kind="reference-code")
        self.finish()
        self.compact()
        before = {path.relative_to(self.root).as_posix(): path.read_bytes() for path in self.root.rglob("*") if path.is_file()}
        with reader.Library(self.root) as library:
            raw = library.read("html")
            self.assertEqual(raw["text"], html)
            self.assertEqual(raw["line_coordinates"], "source-lines")
            view = library.read("html", view="readable", lines=1)
            self.assertEqual(view["text"], "流程字典")
            self.assertTrue(view["truncated"])
            all_text = library.read("html", view="readable")["text"]
            self.assertIn("流程 & 请求", all_text)
            self.assertIn("[图片：字段图]", all_text)
            self.assertNotIn("HIDDEN_", all_text)
            self.assertNotIn("<table>", all_text)
            self.assertEqual(view["line_coordinates"], "readable-view-not-source-lines")
            self.assertEqual(view["document"]["output_sha256"], raw["document"]["output_sha256"])
            self.assertEqual(library.read("form", view="readable")["view"], "source")
            with self.assertRaises(ValueError):
                library.read("html", view="execute")
        after = {path.relative_to(self.root).as_posix(): path.read_bytes() for path in self.root.rglob("*") if path.is_file()}
        self.assertEqual(before, after)

    def test_compact_cli_relocation_with_chinese_space_paths(self):
        self.compact()
        relocated = self.base / "新电脑 中文目录"
        (relocated / "scripts").mkdir(parents=True)
        shutil.copytree(self.root, relocated / "library")
        shutil.copyfile(SCRIPT, relocated / "scripts" / "library_reader.py")
        result = subprocess.run([sys.executable, "-B", str(relocated / "scripts" / "library_reader.py"),
                                 "search", "中文表单", "--platform", "E9"], cwd=self.base,
                                env=dict(os.environ, PYTHONIOENCODING="cp1252"), capture_output=True,
                                encoding="utf-8", check=True)
        self.assertEqual(json.loads(result.stdout)["results"][0]["document_id"], "form")
        self.assertNotIn(str(self.base), result.stdout)


if __name__ == "__main__":
    unittest.main()

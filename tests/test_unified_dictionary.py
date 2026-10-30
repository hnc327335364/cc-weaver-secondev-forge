"""多来源字典语义回归：库表歧义、完整字段、来源追踪与篡改拒绝。"""
import hashlib
import json
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import dictionary_formats as formats
import knowledge_lookup as lookup
from library_reader import DOC_FIELDS, Library


MARKDOWN = """---
table_name: form_field
cn_name: 本地字段
module: 表单引擎
database: project
has_fields: true
---
# form_field
## 字段明细
| 序号 | 数据库列名 | 中文名称 | 数据类型 | 长度 | 允许空值 | 外键 | 自增长 | 默认值 | 主键 | 外键信息 | 说明 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | title | 名称 | 字符 | 250 |  |  |  |  |  |  | 选项 A\\|B |
| 2 | creator | 创建人 | 长整型 |  |  |  |  |  |  |  | 第一行
第二行 |
## 关联
"""
HTML = """<html><table><tr><td>数据库表名</td><td>workflow_requestbase</td><td>中文名称</td><td>请求表</td></tr>
<tr><td>所属模块</td><td>流程</td><td>主键</td><td>requestid</td></tr>
<tr><td></td><td>序号</td><td>数据库列名</td><td>中文名称</td><td>数据类型</td><td>长度</td><td>是否允许空值</td><td>是否为外键</td><td>是否自增长</td><td>外键信息</td><td>默认值</td><td>说明</td></tr>
<tr><td></td><td>1</td><td>requestid</td><td>请求编号</td><td>integer</td><td></td><td>否</td><td>否</td><td>否</td><td></td><td></td><td>原始说明</td></tr></table></html>"""


class FormatTests(unittest.TestCase):
    def test_escaped_pipe_multiline_and_empty_values_preserved(self):
        record = formats.parse_markdown(MARKDOWN.encode())
        self.assertEqual(record["columns"][0]["description"], "选项 A|B")
        self.assertEqual(record["columns"][1]["description"], "第一行\n第二行")
        self.assertEqual(record["columns"][0]["nullable"], "")
        self.assertEqual(record["columns"][0]["length"], "250")

    def test_wrong_header_rejected(self):
        with self.assertRaises(ValueError):
            formats.parse_markdown(MARKDOWN.replace("| 允许空值 |", "| 未知含义 |", 1).encode())

    def test_e9_html_does_not_infer_database(self):
        value = formats.parse_html(HTML.encode())
        self.assertEqual(value["database"], "")
        self.assertEqual(value["columns"][0]["name"], "requestid")
        self.assertEqual(value["primaryKeyRaw"], "requestid")

    def test_unknown_e9_column_rejected(self):
        with self.assertRaises(ValueError):
            formats.parse_html(HTML.replace("是否允许空值", "未知参数").encode())

    def test_e9_alternate_header_keeps_parent_id_and_primary_key(self):
        body = "<table><tr><td>数据库表名</td><td>sample</td></tr><tr><td>序号</td><td>主表ID</td><td>数据库列名</td><td>是否为主键</td></tr><tr><td>1</td><td>42</td><td>id</td><td>是</td></tr></table>"
        field = formats.parse_html(body.encode())["columns"][0]
        self.assertEqual(field["parentTableIdRaw"], "42")
        self.assertEqual(field["primaryKey"], "是")


class UnifiedDictionaryTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory(prefix="cc-unified-dictionary-")
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name).resolve()
        catalog = sqlite3.connect(self.root / "catalog.sqlite")
        catalog.execute("CREATE TABLE sources(id TEXT PRIMARY KEY,label TEXT,version TEXT,root_path TEXT)")
        catalog.execute("CREATE TABLE documents(" + ",".join(name + (" INTEGER" if name.endswith("bytes") or name == "line_count" else " TEXT") for name in DOC_FIELDS) + ",text TEXT,safety_changes TEXT)")
        index = sqlite3.connect(self.root / "dictionary.sqlite")
        index.executescript("""PRAGMA user_version=1;
            CREATE TABLE metadata(key TEXT PRIMARY KEY,value TEXT);
            CREATE TABLE tables(entry_id INTEGER PRIMARY KEY,document_id TEXT,platform TEXT,source_id TEXT,source_version TEXT,format TEXT,database_name TEXT,table_name TEXT,label TEXT,module TEXT,field_count INTEGER,flags TEXT);
            CREATE TABLE fields(entry_id INTEGER,ordinal INTEGER,name TEXT,label TEXT);
        """)
        original = json.dumps(dict(tableName="form_field", displayName="字段", database="formreport", module="表单引擎",
                                   columns=[dict(name="title", label="标题", typeRaw="字符", length="100", nullable=None)]))
        items = [("doc-a", "ecode-toolkit", "1.3.4", "skills/e10-data-dictionary/references/records/form_field.json", "E10", original),
                 ("doc-b", "weaver-vault", "local-snapshot", "本地/Obsidian泛微E10知识库/数据表/表单/form_field.md", "E10", MARKDOWN),
                 ("doc-c", "weaver-vault", "local-snapshot", "本地/E9数据字典-20261022/工作流程/workflow_requestbase.html", "E9", HTML)]
        corpus = hashlib.sha256()
        for number, (identity, source, version, path, platform, text) in enumerate(items, 1):
            data = text.encode("utf-8")
            sha = hashlib.sha256(data).hexdigest()
            object_path = f"objects/{sha[:2]}/{sha}.txt"
            destination = self.root / object_path
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(data)
            row = dict(id=identity, source_id=source, source_path=path, source_version=version, title=Path(path).stem,
                       platform=platform, kind="reference-document", media_type="text/plain", object_path=object_path,
                       source_sha256=sha, output_sha256=sha, source_bytes=len(data), output_bytes=len(data),
                       encoding="utf-8", line_count=len(text.splitlines()))
            catalog.execute("INSERT INTO documents VALUES(" + ",".join("?" for _ in range(len(DOC_FIELDS)+2)) + ")",
                            [*(row[name] for name in DOC_FIELDS), text, "[]"])
            fmt = formats.dictionary_format(row)
            record = formats.parse_record(data, fmt)
            index.execute("INSERT INTO tables VALUES(?,?,?,?,?,?,?,?,?,?,?,?)", (number, identity, platform, source, version,
                          fmt, record["database"], record["tableName"], record["displayName"], record["module"], len(record["columns"]), "[]"))
            index.executemany("INSERT INTO fields VALUES(?,?,?,?)", [(number, i, field["name"], field["label"]) for i, field in enumerate(record["columns"], 1)])
            corpus.update((identity + "\0" + sha + "\n").encode())
        catalog.commit()
        catalog.close()
        index.executemany("INSERT INTO metadata VALUES(?,?)", [("status", "complete"), ("corpus_sha256", corpus.hexdigest()), ("summary", '{"tables":3,"fields":4}')])
        index.commit()
        index.close()
        self.manifest = dict(schema_version=1, catalog_sha256=self.hash("catalog.sqlite"), extensions={"dictionary": dict(
            path="dictionary.sqlite", sha256=self.hash("dictionary.sqlite"), bytes=(self.root / "dictionary.sqlite").stat().st_size,
            corpus_sha256=corpus.hexdigest(), schema_version=1)})
        self.save()

    def hash(self, path):
        return hashlib.sha256((self.root / path).read_bytes()).hexdigest()

    def save(self):
        (self.root / "manifest.json").write_text(json.dumps(self.manifest), encoding="utf-8")

    def query(self, action, query, **kwargs):
        with Library(self.root) as library:
            return lookup.dictionary(library, action, query, **kwargs)

    def test_same_name_returns_both_sources_and_ambiguous_load(self):
        result = self.query("search", "form_field")
        self.assertEqual({r["database"] for r in result["results"]}, {"project", "formreport"})
        ambiguous = self.query("load", "form_field")
        self.assertEqual(ambiguous["status"], "ambiguous")
        self.assertNotIn("record", ambiguous)

    def test_load_by_database_preserves_distinct_lengths(self):
        original = self.query("load", "form_field", database="formreport")
        local = self.query("load", "form_field", database="project")
        self.assertEqual(original["record"]["columns"][0]["length"], "100")
        self.assertEqual(local["record"]["columns"][0]["length"], "250")
        self.assertEqual(len(local["record"]["columns"]), 2)

    def test_exact_document_selection_and_wrong_table_rejected(self):
        value = self.query("load", "form_field", document_id="doc-b")
        self.assertEqual(value["source"]["document_id"], "doc-b")
        with self.assertRaises(ValueError):
            self.query("load", "form_field", document_id="doc-c")

    def test_local_only_column_is_found_and_filter_is_correct(self):
        value = self.query("find-column", "创建人", platform="E10", database="project")
        self.assertEqual(value["total"], 1)
        self.assertEqual(value["results"][0]["columnName"], "creator")
        self.assertEqual(self.query("find-column", "创建人", database="formreport")["total"], 0)

    def test_e9_lookup_is_separate_and_does_not_invent_database(self):
        value = self.query("load", "workflow_requestbase", platform="E9")
        self.assertEqual(value["record"]["columns"][0]["name"], "requestid")
        self.assertEqual(value["record"]["database"], "")
        self.assertEqual(self.query("search", "workflow_requestbase", platform="E10")["total"], 0)

    def test_source_version_and_pagination(self):
        value = self.query("search", "form_field", limit=1)
        self.assertTrue(value["has_more"])
        next_page = self.query("search", "form_field", limit=1, offset=1)
        self.assertNotEqual(value["results"][0]["document_id"], next_page["results"][0]["document_id"])
        original = self.query("search", "form_field", source="ecode-toolkit", version="1.3.4")
        self.assertEqual(original["total"], 1)

    def test_tampered_index_is_rejected(self):
        with (self.root / "dictionary.sqlite").open("ab") as stream:
            stream.write(b"tamper")
        with self.assertRaisesRegex(ValueError, "完整性"):
            self.query("search", "form_field")

    def test_stale_corpus_is_rejected(self):
        with sqlite3.connect(self.root / "catalog.sqlite") as catalog:
            catalog.execute("UPDATE documents SET output_sha256=? WHERE id='doc-b'", ("0"*64,))
        self.manifest["catalog_sha256"] = self.hash("catalog.sqlite")
        self.save()
        with self.assertRaisesRegex(ValueError, "语料不一致"):
            self.query("search", "form_field")

    def test_full_source_path_resolves_local_notes(self):
        with Library(self.root) as library:
            row = lookup.resolve(library, "本地/Obsidian泛微E10知识库/数据表/表单/form_field.md")
            self.assertEqual(row["id"], "doc-b")

    def test_sql_metacharacters_are_literal(self):
        self.assertEqual(self.query("search", "%' OR 1=1 --")["total"], 0)
        for query in ("", " "*2, "x"*301):
            with self.assertRaises(ValueError):
                self.query("search", query)

    def test_reference_template_name_is_not_a_sql_identifier(self):
        row = dict(document_id="template", platform="E9", source_id="weaver-vault", source_version="snapshot",
                   table_name="FnaTemplateMember_*", label="模板", database_name="", module="财务", field_count=0, flags="[]")
        index = lookup.DictionaryIndex.__new__(lookup.DictionaryIndex)
        self.assertIn("non-literal-table-name; reference-only-not-sql-identifier", index.candidate(row)["flags"])
        with self.assertRaises(ValueError):
            self.query("load", "form_field\x00")


if __name__ == "__main__":
    unittest.main()

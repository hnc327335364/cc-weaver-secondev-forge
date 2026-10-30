#!/usr/bin/env python3
"""统一查询 E9/E10 多来源字典与正文；保留版本和歧义，不联网、不执行 SQL。"""
from __future__ import annotations

import hashlib
import json
import re
import sqlite3
import sys
from pathlib import Path, PurePosixPath

sys.dont_write_bytecode = True
from library_reader import Library, DEFAULT_ROOT, DOC_FIELDS, metadata, safe_path, open_regular, stream_hash, JsonArgumentParser
from dictionary_formats import dictionary_format, parse_record

BOUNDARY = "离线字典不是现场结构验证或 SQL 写入授权；来源版本不是客户产品基线，字段须与现场 API/RPC 和权限核对。"


def resolve(library, path, source=None):
    value = PurePosixPath(path)
    if value.is_absolute() or ".." in value.parts or "\\" in path or ":" in path or not path or value.as_posix() != path:
        raise ValueError("请提供包内来源相对路径，不使用本机路径")
    escaped = path.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    where, args = "(source_path=? OR source_path LIKE ? ESCAPE '\\')", [path, "%/" + escaped]
    if source:
        where += " AND source_id=?"
        args.append(source)
    rows = list(library.db.execute("SELECT " + ",".join(DOC_FIELDS) + " FROM documents WHERE " + where, args))
    if len(rows) != 1:
        raise ValueError("来源路径未唯一命中，请使用共享全文检索定位，不读取维护者机器路径")
    return rows[0]


def legacy_dictionary(library, action, query, limit=10, offset=0, module=None, database=None):
    base = "skills/e10-data-dictionary/references/"
    if action == "load":
        if not re.fullmatch(r"[A-Za-z0-9_]+", query):
            raise ValueError("表名格式不合法")
        row = resolve(library, base + "records/" + query + ".json")
        with library.object(row) as stream:
            record = json.load(stream)
        if database and record.get("database") != database:
            raise ValueError("目标数据库与字典记录不符，不按同名表猜测")
        # 不带出维护者姓名等与字段契约无关的来源元数据。
        selected = {key: record.get(key) for key in ("tableName", "displayName", "database", "module", "columns", "indexes", "foreignKeys") if key in record}
        return {"source": metadata(row), "record": selected, "boundary": "离线字典不是现场结构验证；字段只用于当前版本核对，不连接数据库、不执行SQL"}
    row = resolve(library, base + ("columns-index.jsonl" if action == "find-column" else "index.jsonl"))
    terms = [item.casefold() for item in re.split(r"[\s_]+", query.strip()) if item]
    if not terms or not 1 <= limit <= 100 or offset < 0:
        raise ValueError("请输入关键词；limit为1至100，offset不能为负")
    found = []
    databases = {}
    if database and action == "find-column":
        table_index = resolve(library, base + "index.jsonl")
        with library.object(table_index) as stream:
            for line in stream:
                entry = json.loads(line)
                databases[entry["tableName"]] = entry.get("database")
    with library.object(row) as stream:
        for line in stream:
            record = json.loads(line)
            if module and record.get("module") != module:
                continue
            if database and (record.get("database") or databases.get(record.get("tableName"))) != database:
                continue
            haystack = json.dumps(record, ensure_ascii=False).casefold().replace("_", " ")
            if all(term in haystack for term in terms):
                selected = {key: val for key, val in record.items() if key not in {"searchText", "columnKeywords"}}
                normalize = lambda text: re.sub(r"[\s_]+", " ", str(text).casefold()).strip()
                term = normalize(query)
                # 名称精确命中优先于字段正文匹配，避免目标表被无关索引淹没。
                names = [normalize(record.get(key, "")) for key in ("tableName", "displayName", "columnName", "label")]
                score = 100 if term in names else 20 if any(term in name for name in names) else 1
                found.append((score, selected))
    found.sort(key=lambda item: (-item[0], item[1].get("tableName", ""), item[1].get("columnName", "")))
    return {"source": metadata(row), "total": len(found), "offset": offset,
            "results": [item[1] for item in found[offset:offset + limit]], "has_more": offset + limit < len(found),
            "next": "候选命中后使用 dictionary load 读取完整字段，再与现场版本核对"}


class DictionaryIndex:
    def __init__(self, library):
        self.library = library
        spec = library.manifest.get("extensions", {}).get("dictionary")
        if not isinstance(spec, dict) or spec.get("path") != "dictionary.sqlite" or spec.get("schema_version") != 1:
            raise ValueError("共享结构字典未登记，请使用全文检索，不把单来源查询称为统一检索")
        path = safe_path(library.root, spec["path"])
        with open_regular(path) as stream:
            digest, size = stream_hash(stream)
        if digest != spec.get("sha256") or size != spec.get("bytes"):
            raise ValueError("共享字典索引完整性不符，请重新取得完整包")
        self.db = sqlite3.connect(path.as_uri() + "?mode=ro&immutable=1", uri=True)
        self.db.row_factory = sqlite3.Row
        try:
            self.db.execute("PRAGMA query_only=ON")
            self.db.execute("PRAGMA trusted_schema=OFF")
            for table in ("metadata", "tables", "fields"):
                kind = self.db.execute("SELECT type FROM sqlite_master WHERE name=?", (table,)).fetchone()
                if kind is None or kind[0] != "table":
                    raise ValueError("字典索引结构不完整")
            self.meta = dict(self.db.execute("SELECT key,value FROM metadata"))
            if self.meta.get("status") != "complete" or self.db.execute("PRAGMA user_version").fetchone()[0] != 1:
                raise ValueError("字典索引未完整构建")
            # 只核对字典语料的逻辑指纹；无损压缩改变物理路径，不改变来源与字段。
            signature = hashlib.sha256()
            for row in library.db.execute("SELECT * FROM documents ORDER BY id"):
                if dictionary_format(row):
                    signature.update((row["id"] + "\0" + row["output_sha256"] + "\n").encode())
            if signature.hexdigest() != self.meta.get("corpus_sha256") or signature.hexdigest() != spec.get("corpus_sha256"):
                raise ValueError("字典索引与当前语料不一致，需重新构建")
        except Exception:
            self.db.close()
            raise

    def candidate(self, row):
        result = {"document_id": row["document_id"], "platform": row["platform"], "source_id": row["source_id"],
                  "source_version": row["source_version"], "tableName": row["table_name"],
                  "displayName": row["label"], "database": row["database_name"], "module": row["module"],
                  "field_count": row["field_count"], "flags": json.loads(row["flags"])}
        if not re.fullmatch(r"[A-Za-z0-9_]+", row["table_name"]):
            result["flags"].append("non-literal-table-name; reference-only-not-sql-identifier")
        return result


def dictionary(library, action, query, limit=10, offset=0, module=None, database=None,
               platform=None, source=None, version=None, document_id=None):
    if not isinstance(query, str) or not query.strip() or len(query) > 300 or not 1 <= limit <= 100 or offset < 0:
        raise ValueError("请输入 1 至 300 字符查询；limit 为 1 至 100，offset 不能为负")
    if action not in {"load", "search", "find-column"}:
        raise ValueError("不支持的字典操作")
    if not library.manifest.get("extensions", {}).get("dictionary"):
        if any(value is not None for value in (platform, source, version, document_id)):
            raise ValueError("此旧包没有统一结构索引；请升级或使用全文检索")
        result = legacy_dictionary(library, action, query, limit, offset, module, database)
        result["coverage"] = "legacy-ecode-only; not-unified"
        return result
    index = DictionaryIndex(library)
    try:
        clauses, args = [], []
        for key, value in (("module", module), ("database_name", database), ("platform", platform),
                           ("source_id", source), ("source_version", version), ("document_id", document_id)):
            if value is not None:
                clauses.append("t." + key + "=? COLLATE NOCASE")
                args.append(value)
        if action == "load":
            # 资料可能以 FnaTemplateMember_* 等模板命名；此处只做参数化等值检索，不把它当 SQL 标识符。
            if any(ord(char) < 32 for char in query):
                raise ValueError("表名不得含控制字符")
            clauses.append("t.table_name=? COLLATE NOCASE")
            args.append(query)
            rows = index.db.execute("SELECT t.* FROM tables t WHERE " + " AND ".join(clauses) +
                                    " ORDER BY t.platform,t.database_name,t.source_id,t.document_id", args).fetchall()
            if not rows:
                raise ValueError("指定库、表或来源未找到；先搜索候选，不按相似名称补字段")
            if len(rows) != 1:
                return {"status": "ambiguous", "total": len(rows), "offset": offset,
                        "candidates": [index.candidate(row) for row in rows[offset:offset + limit]],
                        "has_more": offset + limit < len(rows), "boundary": BOUNDARY,
                        "next": "按实际数据库/来源筛选，或用候选 document_id 明确选择；多份记录不自动合并。"}
            row = rows[0]
            source_row = library.document(row["document_id"])
            with library.object(source_row) as stream:
                record = parse_record(stream.read(), row["format"])
            if (record["tableName"] != row["table_name"] or (record.get("database") or "") != row["database_name"]
                    or len(record["columns"]) != row["field_count"]):
                raise ValueError("结构索引与正文不符，不能沿用旧字段")
            return {"status": "single_record", "source": metadata(source_row), "record": record,
                    "selection": index.candidate(row), "boundary": BOUNDARY}
        terms = [item.casefold() for item in re.split(r"[\s_]+", query.strip()) if item]
        if not terms or len(terms) > 12:
            raise ValueError("最多 12 个查询词")
        # 表检索不被全库字段中的常用词淹没；字段查询明确使用 find-column。
        body = "t.table_name || char(10) || t.label || char(10) || t.module"
        join, selected, names = "", "t.*", ["t.table_name", "t.label"]
        if action == "find-column":
            join = " JOIN fields f ON f.entry_id=t.entry_id"
            selected += ",f.name AS column_name,f.label AS column_label,f.ordinal AS column_ordinal"
            body += " || char(10) || f.name || char(10) || f.label"
            names = ["f.name", "f.label"]
        for term in terms:
            clauses.append("instr(replace(lower(" + body + "),'_', ' '),?)>0")
            args.append(term)
        where = " WHERE " + " AND ".join(clauses)
        total = index.db.execute("SELECT count(*) FROM tables t" + join + where, args).fetchone()[0]
        normalized = " ".join(terms)
        exact = " OR ".join("replace(lower(" + name + "),'_', ' ')=?" for name in names)
        rows = index.db.execute("SELECT " + selected + " FROM tables t" + join + where +
                                " ORDER BY CASE WHEN (" + exact + ") THEN 0 ELSE 1 END,t.table_name,t.database_name,t.source_id,t.document_id" +
                                (",f.ordinal" if action == "find-column" else "") + " LIMIT ? OFFSET ?",
                                [*args, *([normalized] * len(names)), limit, offset]).fetchall()
        results = []
        for row in rows:
            item = index.candidate(row)
            if action == "find-column":
                item.update(columnName=row["column_name"], label=row["column_label"], column_ordinal=row["column_ordinal"])
            results.append(item)
        return {"coverage": json.loads(index.meta["summary"]), "total": total, "offset": offset,
                "results": results, "has_more": offset + limit < total, "boundary": BOUNDARY,
                "next": "使用 load 读取完整字段；同名多来源请显式选择 document_id，不把来源版本视为客户基线。"}
    finally:
        index.db.close()


def topic(library, query=None):
    routes_path = Path(__file__).resolve().parents[1] / "references" / "topic-routes.json"
    routes = json.loads(routes_path.read_text(encoding="utf-8"))["topics"]
    choices = [{"id": r["id"], "title": r["title"], "aliases": r["aliases"]} for r in routes]
    if not query:
        return {"topics": choices, "body_searched": False}
    normalized = query.strip().casefold()
    selected = [r for r in routes if normalized in
                [str(x).casefold() for x in [r["id"], r["title"], *r["aliases"]]]]
    if not selected:
        return {"matched_topics": 0, "topics": choices, "body_searched": False,
                "next": "主题未登记不代表正文无资料；按精确方法名或来源路径检索"}
    result = []
    for route in selected:
        documents, missing = [], []
        for source_path in route["source_paths"]:
            try:
                row = resolve(library, source_path)
            except ValueError:
                missing.append(source_path)
            else:
                documents.append(metadata(row))
        result.append({"id": route["id"], "title": route["title"], "documents": documents,
                       "missing_or_ambiguous_sources": missing, "guidance": route["guidance"]})
    return {"matched_topics": len(result), "results": result, "body_searched": False,
            "next": "先locate方法名或read正文；本入口只定位来源，不证明API适合现场"}


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = JsonArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=DEFAULT_ROOT, help="默认按脚本定位共享 library")
    sub = parser.add_subparsers(dest="mode", required=True)
    topics = sub.add_parser("topic", help="直接定位常见主题；不带参数列出主题")
    topics.add_argument("query", nargs="?")
    source = sub.add_parser("source")
    source.add_argument("path")
    source.add_argument("--source")
    source.add_argument("--start", type=int, default=1, help="起始行，从1开始；续读使用next_line")
    source.add_argument("--lines", type=int, default=100, help="每次1至200行，默认100；截断后按next_line/next_column续读")
    source.add_argument("--chars", type=int, default=16000, help="每次1至20000字符，默认16000")
    source.add_argument("--column", type=int, default=0, help="起始Unicode字符列，从0开始；长行续读使用next_column")
    source.add_argument("--compact", action="store_true", help="省略重复lines数组，保留text、来源哈希及续读标记")
    data = sub.add_parser("dictionary")
    data.add_argument("action", choices=("search", "find-column", "load"))
    data.add_argument("query")
    data.add_argument("--limit", type=int, default=10)
    data.add_argument("--offset", type=int, default=0)
    data.add_argument("--module")
    data.add_argument("--database")
    data.add_argument("--platform", choices=("E9", "E10"))
    data.add_argument("--source")
    data.add_argument("--version", help="来源版本标签，不是客户平台版本")
    data.add_argument("--document-id", help="多来源候选的明确文档编号")
    args = vars(parser.parse_args())
    mode = args.pop("mode")
    root = args.pop("root")
    compact = args.pop("compact", False)
    try:
        with Library(root) as library:
            if mode == "topic":
                result = topic(library, **args)
            elif mode == "source":
                row = resolve(library, args.pop("path"), args.pop("source"))
                result = library.read(row["id"], **args)
            else:
                result = dictionary(library, **args)
        if compact:
            result.pop("lines", None)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    except (ValueError, OSError, KeyError, sqlite3.Error, json.JSONDecodeError) as error:
        print(json.dumps({"error": str(error) if isinstance(error, ValueError) else type(error).__name__}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

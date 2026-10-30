"""严格读取随包三类字典；只归一键名，不推断空值、数据库或版本。"""
from __future__ import annotations

from html.parser import HTMLParser
import json
import re

HEADERS = ["序号", "数据库列名", "中文名称", "数据类型", "长度", "允许空值", "外键", "自增长", "默认值", "主键", "外键信息", "说明"]
FIELD_KEYS = ["seq", "name", "label", "typeRaw", "length", "nullable", "foreignKey", "autoIncrement", "defaultValue", "primaryKey", "foreignKeyInfo", "description"]
LIFECYCLE = re.compile(r"废弃|作废|弃用|停用|不再使用|测试不可用|deprecated|obsolete", re.I)


def dictionary_format(row):
    path = row["source_path"]
    if "/skills/e10-data-dictionary/references/records/" in "/" + path and path.endswith(".json"):
        return "e10-json"
    if "/Obsidian泛微E10知识库/数据表/" in path and path.endswith(".md"):
        return "e10-markdown"
    if "/E9数据字典-" in path and "/ER图/" not in path and path.endswith(".html") and not path.endswith("/index.html"):
        return "e9-html"
    return None


def table_cells(row):
    """沿用已核验的派生字典规则：仅未转义的竖线是边界，保留多行及空值。"""
    parts, pending = [], []
    for char in row:
        slashes = len(pending) - len("".join(pending).rstrip("\\"))
        if char == "|" and slashes % 2 == 0:
            parts.append("".join(pending).strip().replace(r"\|", "|"))
            pending = []
        else:
            pending.append(char)
    parts.append("".join(pending).strip().replace(r"\|", "|"))
    if parts[0] or parts[-1]:
        raise ValueError("字段行缺少完整边界")
    return parts[1:-1]


def parse_markdown(raw):
    # 规则来自维护端 build_e10_derived_dictionary.parse_note；不加载个人元数据。
    lines = raw.decode("utf-8-sig").replace("\r\n", "\n").replace("\r", "\n").splitlines()
    if not lines or lines[0] != "---" or "---" not in lines[1:]:
        raise ValueError("字典缺少完整 frontmatter")
    end = lines.index("---", 1)
    meta = {}
    for line in lines[1:end]:
        if ":" in line:
            key, value = line.split(":", 1)
            meta[key.strip()] = value.strip().strip("\"'")
    if "table_name" not in meta or "database" not in meta:
        raise ValueError("缺少库表元数据，不从路径猜测")
    rows, pending, start, last = [], [], 0, 0
    active = found = False
    for number, line in enumerate(lines, 1):
        if line == "## 字段明细":
            active = found = True
            continue
        if active and line.startswith("## "):
            break
        if not active:
            continue
        if line.startswith("|"):
            if pending:
                rows.append((start, last, "\n".join(pending)))
            pending, start, last = [line], number, number
        elif pending and line.strip():
            pending.append(line)
            last = number
    if pending:
        rows.append((start, last, "\n".join(pending)))
    fields, seen = [], False
    for first, last, text in rows:
        values = table_cells(text)
        if values == HEADERS:
            seen = True
        elif len(values) == 12 and all(re.fullmatch(r":?-+:?", value) for value in values):
            continue
        elif not seen or len(values) != 12 or not values[0].isdigit():
            raise ValueError("字段格式不确定：要求确认的表头及 12 列")
        else:
            fields.append(dict(zip(FIELD_KEYS, values), line_start=first, line_end=last))
    if (found and not seen) or (not found and meta.get("has_fields") != "false"):
        raise ValueError("字段章节缺失或未确认")
    return dict(tableName=meta["table_name"], displayName=meta.get("cn_name", ""),
                database=meta["database"], module=meta.get("module", ""),
                columns=fields, tableType=meta.get("type", ""))


class TableRows(HTMLParser):
    """只读 HTML 表格的实际单元格；不执行脚本，也不推断 rowspan/colspan 的字段值。"""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack, self.rows = [], []
        self.hidden = 0

    def handle_starttag(self, tag, attrs):
        if tag in {"script", "style"}:
            self.hidden += 1
        if self.hidden:
            return
        if tag == "tr":
            self.stack.append({"cells": [], "cell": None})
        elif tag in {"td", "th"} and self.stack:
            self.stack[-1]["cell"] = []
        elif tag == "br":
            self.handle_data("\n")

    def handle_endtag(self, tag):
        if tag in {"script", "style"}:
            self.hidden = max(0, self.hidden - 1)
            return
        if self.hidden:
            return
        if tag in {"td", "th"} and self.stack:
            row = self.stack[-1]
            if row["cell"] is not None:
                row["cells"].append("".join(row["cell"]).strip())
                row["cell"] = None
        elif tag == "tr" and self.stack:
            row = self.stack.pop()
            self.rows.append(row["cells"])

    def handle_data(self, data):
        if not self.hidden and self.stack and self.stack[-1]["cell"] is not None:
            self.stack[-1]["cell"].append(data)


def parse_html(raw):
    parser = TableRows()
    parser.feed(raw.decode("utf-8-sig"))
    metadata, fields, headers = {}, [], None
    header_keys = {"序号": "seq", "数据库列名": "name", "中文名称": "label", "数据类型": "typeRaw",
                   "长度": "length", "是否允许空值": "nullable", "是否为外键": "foreignKey",
                   "是否自增长": "autoIncrement", "外键信息": "foreignKeyInfo", "默认值": "defaultValue", "说明": "description",
                   "主表ID": "parentTableIdRaw", "是否为主键": "primaryKey"}
    for row in parser.rows:
        if "数据库列名" in row and "序号" in row:
            headers = row
            if any(value and value not in header_keys for value in row):
                raise ValueError("E9 字段表头含未知列，不静默丢列")
            continue
        if headers and any(value.isdigit() for value in row[:2]):
            if len(row) != len(headers):
                raise ValueError("E9 字段列数与表头不符")
            fields.append({header_keys[key]: value for key, value in zip(headers, row) if key})
            continue
        for key in ("数据库表名", "中文名称", "所属模块", "主键"):
            if key in row:
                index = row.index(key)
                if index + 1 < len(row):
                    metadata[key] = row[index + 1]
    if not metadata.get("数据库表名") or headers is None:
        raise ValueError("不是已确认的 E9 单表字典格式")
    return dict(tableName=metadata["数据库表名"], displayName=metadata.get("中文名称", ""),
                database="", module=metadata.get("所属模块", ""), columns=fields,
                primaryKeyRaw=metadata.get("主键", ""))


def parse_record(raw, format_name):
    if format_name == "e10-json":
        value = json.loads(raw)
        if not isinstance(value, dict) or not isinstance(value.get("columns"), list) or not value.get("tableName"):
            raise ValueError("E10 字典记录缺少表名或字段数组")
        return {key: value[key] for key in ("tableName", "displayName", "database", "module", "columns", "indexes", "foreignKeys") if key in value}
    if format_name == "e10-markdown":
        return parse_markdown(raw)
    if format_name == "e9-html":
        return parse_html(raw)
    raise ValueError("不支持的字典来源格式")

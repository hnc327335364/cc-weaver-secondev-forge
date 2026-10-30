#!/usr/bin/env python3
"""Validate a manifest-driven Weaver E9/E10 HTML delivery document."""

import argparse
import hashlib
import json
import re
import sys
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path


REQUIRED_MANIFEST_FIELDS = {
    "id",
    "kind",
    "name",
    "chapter",
    "maintain_at",
    "source",
    "status",
}
CORE_LABELS = {
    "sidebar": "<aside class=\"sidebar\">",
    "toc": "<nav class=\"toc\">",
    "print_toc": "<nav class=\"print-toc\">",
    "breadcrumb": ".breadcrumb",
    "fold": "[data-fold]",
}
PLACEHOLDER_PATTERN = re.compile(r"\{\{[\s\S]*?\}\}")
STYLE_PATTERN = re.compile(r"<style\b[^>]*>([\s\S]*?)</style\s*>", re.IGNORECASE)
SCRIPT_PATTERN = re.compile(r"<script\b[^>]*>([\s\S]*?)</script\s*>", re.IGNORECASE)
FORBIDDEN_DOCUMENT_PATTERNS = {
    "内部 AGENTS.md 工作指令": re.compile(r"\bAGENTS\.md\b", re.IGNORECASE),
    "平台标准字段 FORM_DATA_ID": re.compile(r"\bFORM_DATA_ID\b", re.IGNORECASE),
}
FIELD_MATRIX_KINDS = {
    "configuration-file",
    "configuration-table",
    "configuration-record",
}
SUPPORTED_PRESENTATIONS = {
    "field-matrix",
    "operation-card",
    "action-flow",
    "interface-flow",
    "release-card",
    "service-card",
    "xml-registration-card",
}


def classes(attrs):
    return set((attrs.get("class") or "").split())


class DeliveryHtmlParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.objects = []
        self.detail_stack = []
        self.section_stack = []
        self.core = set()

    def handle_starttag(self, tag, attrs_list):
        attrs = dict(attrs_list)
        class_names = classes(attrs)

        if tag == "aside" and "sidebar" in class_names:
            self.core.add("sidebar")
        if tag == "nav" and "toc" in class_names:
            self.core.add("toc")
        if tag == "nav" and "print-toc" in class_names:
            self.core.add("print_toc")
        if "breadcrumb" in class_names:
            self.core.add("breadcrumb")
        if "data-fold" in attrs:
            self.core.add("fold")

        if tag == "section":
            self.section_stack.append(
                attrs.get("id") if "chapter" in class_names else None
            )

        if tag == "details":
            object_record = None
            if "object" in class_names:
                object_record = {
                    "id": attrs.get("data-object-id"),
                    "kind": attrs.get("data-object-kind"),
                    "chapter": next(
                        (value for value in reversed(self.section_stack) if value), None
                    ),
                    "tables": 0,
                    "presentation": attrs.get("data-object-presentation"),
                    "has_presentation": bool(attrs.get("data-object-presentation")),
                }
                self.objects.append(object_record)
            self.detail_stack.append(object_record)

        if tag == "table":
            parent_object = next(
                (value for value in reversed(self.detail_stack) if value), None
            )
            if parent_object:
                parent_object["tables"] += 1

        if (
            tag != "details"
            and (
                "object-presentation" in class_names
                or "data-object-presentation" in attrs
            )
        ):
            parent_object = next(
                (value for value in reversed(self.detail_stack) if value), None
            )
            if parent_object:
                parent_object["has_presentation"] = True
                if not parent_object["presentation"]:
                    parent_object["presentation"] = attrs.get(
                        "data-object-presentation"
                    )

    def handle_endtag(self, tag):
        if tag == "details" and self.detail_stack:
            self.detail_stack.pop()
        if tag == "section" and self.section_stack:
            self.section_stack.pop()


def normalized_blocks(pattern, html):
    return [match.group(1).replace("\r\n", "\n") for match in pattern.finditer(html)]


def block_digest(blocks):
    return hashlib.sha256("\0".join(blocks).encode("utf-8")).hexdigest()


def load_manifest(path):
    try:
        data = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError("无法读取对象台账：{}".format(error))

    if not isinstance(data, dict) or not isinstance(data.get("objects"), list):
        raise ValueError("对象台账必须是含 objects 数组的 JSON 对象")

    included = {}
    excluded = set()
    errors = []
    for index, item in enumerate(data["objects"], start=1):
        if not isinstance(item, dict):
            errors.append("objects[{}] 必须是对象".format(index))
            continue
        missing = sorted(REQUIRED_MANIFEST_FIELDS - set(item))
        if missing:
            errors.append("objects[{}] 缺少 {}".format(index, ", ".join(missing)))
            continue
        object_id = item["id"]
        status = item["status"]
        if not isinstance(object_id, str) or not object_id:
            errors.append("objects[{}] 的 id 必须是非空字符串".format(index))
            continue
        if status not in {"included", "excluded"}:
            errors.append("objects[{}] 的 status 只能是 included 或 excluded".format(index))
            continue
        presentation = item.get("presentation")
        if presentation is not None and presentation not in SUPPORTED_PRESENTATIONS:
            errors.append(
                "objects[{}] 的 presentation 不受支持：{}".format(index, presentation)
            )
            continue
        if status == "excluded":
            if not item.get("reason"):
                errors.append("excluded 对象 {} 缺少 reason".format(object_id))
            excluded.add(object_id)
            continue
        if object_id in included:
            errors.append("included 对象 ID 重复：{}".format(object_id))
            continue
        included[object_id] = item

    if errors:
        raise ValueError("；".join(errors))
    return included, excluded


def validate(document_path, template_path, manifest_path):
    errors = []
    document = Path(document_path)
    template = Path(template_path)
    try:
        html = document.read_text(encoding="utf-8")
        template_html = template.read_text(encoding="utf-8")
    except OSError as error:
        return ["无法读取 HTML：{}".format(error)], {}

    try:
        included, excluded = load_manifest(manifest_path)
    except ValueError as error:
        return [str(error)], {}

    if PLACEHOLDER_PATTERN.search(html):
        errors.append("最终 HTML 仍含 {{...}} 占位符")
    if "/Users/" in html or "file://" in html:
        errors.append("最终 HTML 含本机绝对路径或 file:// 链接")
    for label, pattern in FORBIDDEN_DOCUMENT_PATTERNS.items():
        if pattern.search(html):
            errors.append("最终 HTML 含{}，不能写入客户交付文档".format(label))

    parser = DeliveryHtmlParser()
    parser.feed(html)
    parser.close()

    missing_core = sorted(set(CORE_LABELS) - parser.core)
    if missing_core:
        errors.append(
            "模板核心缺失：{}".format(
                ", ".join(CORE_LABELS[key] for key in missing_core)
            )
        )

    if normalized_blocks(STYLE_PATTERN, html) != normalized_blocks(
        STYLE_PATTERN, template_html
    ):
        errors.append("内嵌样式与通用模板不一致")
    if normalized_blocks(SCRIPT_PATTERN, html) != normalized_blocks(
        SCRIPT_PATTERN, template_html
    ):
        errors.append("内嵌交互脚本与通用模板不一致")

    document_ids = [item["id"] for item in parser.objects if item["id"]]
    id_counts = Counter(document_ids)
    missing_ids = sorted(set(included) - set(document_ids))
    unexpected_ids = sorted(set(document_ids) - set(included))
    duplicate_ids = sorted(object_id for object_id, count in id_counts.items() if count > 1)
    anonymous = [item for item in parser.objects if not item["id"]]

    if missing_ids:
        errors.append("台账 included 对象未生成：{}".format(", ".join(missing_ids)))
    if unexpected_ids:
        errors.append("HTML 出现未在台账 included 的对象：{}".format(", ".join(unexpected_ids)))
    if duplicate_ids:
        errors.append("HTML 对象块重复：{}".format(", ".join(duplicate_ids)))
    if anonymous:
        errors.append("存在缺少 data-object-id 的对象块：{} 个".format(len(anonymous)))
    leaked_excluded = sorted(set(document_ids) & excluded)
    if leaked_excluded:
        errors.append("excluded 对象仍出现在 HTML：{}".format(", ".join(leaked_excluded)))

    for item in parser.objects:
        object_id = item["id"]
        expected = included.get(object_id)
        if not expected:
            continue
        if item["kind"] != expected["kind"]:
            errors.append(
                "对象 {} 类型不一致：HTML={}，台账={}".format(
                    object_id, item["kind"], expected["kind"]
                )
            )
        if item["chapter"] != expected["chapter"]:
            errors.append(
                "对象 {} 章节不一致：HTML={}，台账={}".format(
                    object_id, item["chapter"], expected["chapter"]
                )
            )
        presentation = item["presentation"]
        expected_presentation = expected.get("presentation")
        if presentation and presentation not in SUPPORTED_PRESENTATIONS:
            errors.append(
                "对象 {} 使用了不受支持的 data-object-presentation：{}".format(
                    object_id, presentation
                )
            )
        if expected_presentation and presentation != expected_presentation:
            errors.append(
                "对象 {} 展示类型不一致：HTML={}，台账={}".format(
                    object_id, presentation or "未设置", expected_presentation
                )
            )

        is_xml_registration_card = (
            item["kind"] == "configuration-file"
            and presentation == "xml-registration-card"
        )
        if is_xml_registration_card:
            if not item["has_presentation"] or item["tables"] > 1:
                errors.append(
                    "XML 注册对象 {} 必须使用独立 XML 注册展示单元，且最多保留一张无脚本回退表".format(
                        object_id
                    )
                )
        elif item["kind"] in FIELD_MATRIX_KINDS:
            if item["tables"] != 1:
                errors.append(
                    "字段型对象 {} 必须恰好有一张独立字段表，当前为 {} 张".format(
                        object_id, item["tables"]
                    )
                )
        elif item["tables"] > 1:
            errors.append(
                "非字段对象 {} 最多保留一张真实映射表，当前为 {} 张".format(
                    object_id, item["tables"]
                )
            )
        elif item["tables"] == 0 and not item["has_presentation"]:
            errors.append(
                "非字段对象 {} 缺少表格或独立语义展示单元".format(object_id)
            )

    details = {
        "included_count": len(included),
        "excluded_count": len(excluded),
        "html_object_count": len(parser.objects),
        "object_kinds": dict(sorted(Counter(item["kind"] for item in included.values()).items())),
        "style_digest": block_digest(normalized_blocks(STYLE_PATTERN, html)),
        "script_digest": block_digest(normalized_blocks(SCRIPT_PATTERN, html)),
    }
    return errors, details


def main():
    argument_parser = argparse.ArgumentParser(
        description="校验对象台账驱动的泛微 E9/E10 HTML 交付说明。"
    )
    argument_parser.add_argument("document", help="待交付的单文件 HTML")
    argument_parser.add_argument("--template", required=True, help="通用 HTML 模板")
    argument_parser.add_argument("--manifest", required=True, help="临时交付对象台账 JSON")
    args = argument_parser.parse_args()

    errors, details = validate(args.document, args.template, args.manifest)
    if errors:
        print("FAILED")
        for error in errors:
            print("- {}".format(error))
        return 1

    print("PASSED")
    print("- included objects: {}".format(details["included_count"]))
    print("- excluded objects: {}".format(details["excluded_count"]))
    print("- HTML object blocks: {}".format(details["html_object_count"]))
    print("- object kinds: {}".format(json.dumps(details["object_kinds"], ensure_ascii=False)))
    return 0


if __name__ == "__main__":
    sys.exit(main())

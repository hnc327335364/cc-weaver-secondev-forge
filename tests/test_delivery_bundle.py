"""随包正式交付校验：对象遗漏和模板改写不能冒充通过。"""
import importlib.util
import json
import re
import tempfile
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('delivery_validator', ROOT/'scripts/validate_delivery_html.py')
validator=importlib.util.module_from_spec(spec); spec.loader.exec_module(validator)


class DeliveryBundleTests(unittest.TestCase):
    def test_real_bundled_template_and_manifest(self):
        template=ROOT/'assets/delivery/template.html'
        source=template.read_text(encoding='utf-8')
        core='\n'.join(re.findall(r'<(?:style|script)\b[^>]*>[\s\S]*?</(?:style|script)>',source,re.I))
        html='''<!doctype html><html><head><meta charset="utf-8"></head><body>
<aside class="sidebar"><nav class="toc"></nav></aside><nav class="print-toc"></nav>
<div class="breadcrumb"></div><button data-fold="all">折叠</button>
<section class="chapter" id="config"><h2>配置</h2>
<details class="object" data-object-id="config-example" data-object-kind="configuration-file">
<summary><h3>示例配置</h3></summary><table><tr><th>参数</th><th>用途</th></tr>
<tr><td>enabled</td><td>演练开关</td></tr></table></details></section>'''+core+'</body></html>'
        manifest={'document':'离线测试','objects':[{'id':'config-example','kind':'configuration-file','name':'示例配置',
            'chapter':'config','maintain_at':'示例维护入口','source':'fixture.properties','status':'included'}]}
        with tempfile.TemporaryDirectory() as tmp:
            d=Path(tmp)/'handoff.html';m=Path(tmp)/'manifest.json'
            d.write_text(html,encoding='utf-8');m.write_text(json.dumps(manifest),encoding='utf-8')
            errors,details=validator.validate(d,template,m)
            self.assertEqual(errors,[])
            self.assertEqual(details['included_count'],1)
            d.write_text(html.replace('data-object-id="config-example"','data-object-id="wrong"'),encoding='utf-8')
            self.assertTrue(validator.validate(d,template,m)[0])
            d.write_text(html.replace('</body>','<style>body{display:none}</style></body>'),encoding='utf-8')
            self.assertTrue(validator.validate(d,template,m)[0])
            d.write_text(html.replace('示例维护入口','{{missing}}').replace('示例配置','{{missing}}'),encoding='utf-8')
            self.assertTrue(validator.validate(d,template,m)[0])


if __name__=='__main__': unittest.main()

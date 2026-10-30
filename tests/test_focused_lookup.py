"""验证实际故障：错误参数被当结果、中文管道乱码，以及长正文定位成本。"""
import json
import os
import subprocess
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

import test_library_reader as fixtures

SCRIPTS = Path(__file__).resolve().parents[1] / 'scripts'
sys.path.insert(0, str(SCRIPTS))
import knowledge_lookup


class FocusedLookupTests(unittest.TestCase):
    def setUp(self):
        self.f = fixtures.LibraryReaderTests(methodName='runTest')
        self.f.setUp()
        self.addCleanup(self.f.doCleanups)

    def call(self, script, *args):
        env = dict(os.environ, PYTHONIOENCODING='ascii')
        run = subprocess.run([sys.executable, '-B', str(SCRIPTS/script), '--root', str(self.f.root), *args],
                             capture_output=True, env=env)
        return run.returncode, json.loads(run.stdout.decode('utf-8'))

    def test_invalid_cli_returns_parseable_error_before_result_access(self):
        for script, args in [('library_reader.py', ['read', 'form', '--lines', 'wrong']),
                             ('knowledge_lookup.py', ['source', 'E9/表单.md', '--unknown'])]:
            code, value = self.call(script, *args)
            self.assertEqual(code, 2)
            self.assertEqual(value['code'], 'invalid_arguments')
            self.assertNotIn('text', value)

    def test_out_of_range_read_does_not_become_empty_success(self):
        for script,args in [('library_reader.py',['read','form']),('knowledge_lookup.py',['source','E9/表单.md'])]:
            code,value=self.call(script,*args,'--lines','3000')
            self.assertNotEqual(code,0)
            self.assertIn('200',value['error'])
            self.assertNotIn('text',value)

    def test_utf8_piped_lookup_preserves_chinese(self):
        code,value=self.call('knowledge_lookup.py','source','E9/表单.md','--compact')
        self.assertEqual(code,0)
        self.assertIn('中文表单',value['text'])

    def test_locate_returns_real_source_coordinates_and_checked_read(self):
        self.f.reopen()
        body='\n'.join(['开头']*220+['方法目标(param)','返回说明','方法目标(end)'])+'\n'
        self.f.add('long',body,'E9/长文.md','E9')
        self.f.finish(); self.f.compact()
        with fixtures.reader.Library(self.f.root) as lib:
            result=lib.locate('long','方法目标',context=1,limit=1)
            self.assertEqual(result['matched_lines'],2)
            self.assertTrue(result['has_more'])
            hit=result['matches'][0]
            self.assertEqual(hit['line'],221)
            content=lib.read(**hit['read'])
            self.assertIn('方法目标(param)',content['text'])
            self.assertIn('返回说明',content['text'])
            self.assertEqual(lib.locate('long','不存在')['matches'],[])
            with self.assertRaises(ValueError): lib.locate('binary','abc')

    def test_topic_does_not_open_objects_or_fabricate_missing_sources(self):
        routes={'topics':[{'id':'fixture','title':'测试','aliases':['名称'],
                           'source_paths':['E9/表单.md','missing.md'],'guidance':'只定位'}]}
        with fixtures.reader.Library(self.f.root) as lib:
            with patch.object(Path,'read_text',return_value=json.dumps(routes)), \
                 patch.object(lib,'object',side_effect=AssertionError('主题定位不读正文')):
                result=knowledge_lookup.topic(lib,'名称')
                self.assertFalse(result['body_searched'])
                self.assertEqual(result['results'][0]['documents'][0]['document_id'],'form')
                self.assertEqual(result['results'][0]['missing_or_ambiguous_sources'],['missing.md'])
                self.assertEqual(knowledge_lookup.topic(lib,'unknown')['matched_topics'],0)


if __name__=='__main__': unittest.main()

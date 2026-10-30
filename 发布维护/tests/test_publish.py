"""Run after starting release.sim.yaml on port 4900. Uses real HTTP, no real tokens."""
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest
import zipfile
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import publish as p

BASE='http://127.0.0.1:4900/'

class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.old=p.HERE;self.addCleanup(setattr,p,'HERE',self.old)
        p.HERE=Path(self.temp.name)/'maintenance';p.HERE.mkdir()
        root=p.HERE.parent/'weaver-cc-assistant';root.mkdir();(root/'SKILL.md').write_text('fixture')
        self.config={'source':'../weaver-cc-assistant','version':'0.3.0-rc.1','display_name':'CC Weaver Secondev Forge','archive_name':'weaver-cc-assistant.zip','manuals':['使用说明.md']}
        for name in self.config['manuals']:(p.HERE/name).write_bytes(b'fixture-only')
        self.archive=p.HERE/'weaver-cc-assistant.zip'
        with zipfile.ZipFile(self.archive,'w') as z:z.write(root/'SKILL.md','weaver-cc-assistant/SKILL.md')
        (p.HERE/'release-notes').mkdir()
        self.note=p.HERE/'release-notes/v0.3.0-rc.1.md'
        self.original=(self.old/'release-notes/v0.3.0-rc.1.md').read_text()
        self.note.write_text(self.original)
        self.repos={'github':'test/repo','gitee':'test/repo'}
        self.controls={k:p.API(BASE+k,'TEST_ONLY_TOKEN') for k in self.repos}
        self.apis={k:p.API(BASE+k+('/v5' if k=='gitee' else ''),'TEST_ONLY_TOKEN',BASE+k) for k in self.repos}
        for api in self.controls.values():api.request('/reset')
    def publish(self):p.publish(self.config,self.repos,self.apis,self.archive,'a'*40)
    def audit(self,k):return self.controls[k].request('/audit')
    def test_success_repeat(self):
        self.publish();self.publish()
        for k in self.repos:
            a=self.audit(k);self.assertEqual(a['events'].count('create'),1);self.assertEqual(a['events'].count('upload'),1)
            self.assertEqual(len(a['files']),1);self.assertNotIn('[上传中]',a['release']['name'])
            self.assertIn('## 优化改进',a['release']['body']);self.assertIn('## 问题修复',a['release']['body'])
        self.assertEqual(self.audit('github')['release']['body'],self.audit('gitee')['release']['body'])
    def test_source_only_release(self):
        p.publish(self.config,self.repos,self.apis,None,'a'*40)
        for k in self.repos:
            a=self.audit(k);self.assertEqual(a['events'].count('upload'),0)
            self.assertIn('finalize',a['events']);self.assertIn('CC-FORGE-TREE-SHA256',a['release']['body'])
    def test_upload_failure(self):
        self.controls['gitee'].request('/reset?mode=fail-upload')
        with self.assertRaises(RuntimeError):self.publish()
        for k in self.repos:self.assertNotIn('finalize',self.audit(k)['events'])
        self.assertTrue(self.audit('github')['release']['draft'])
    def test_download_corrupt(self):
        self.controls['gitee'].request('/reset?mode=corrupt')
        with self.assertRaises(ValueError):self.publish()
        for k in self.repos:self.assertNotIn('finalize',self.audit(k)['events'])
    def test_notes_changed_same_version(self):
        self.publish();before={k:self.audit(k)['events'] for k in self.repos}
        self.note.write_text(self.original.replace('重点改善','主要改善'))
        with self.assertRaises(ValueError):self.publish()
        for k in self.repos:self.assertEqual(before[k],self.audit(k)['events'])
    def test_missing_notes(self):
        self.note.unlink()
        with self.assertRaises(OSError):self.publish()
        for k in self.repos:self.assertEqual(self.audit(k)['events'],[])
    def test_missing_section(self):
        self.note.write_text(self.original.replace('## 问题修复','## 其他事项'))
        with self.assertRaises(ValueError):p.release_notes(self.config)
    def test_placeholder(self):
        self.note.write_text(self.original+'\nTODO\n')
        with self.assertRaises(ValueError):p.release_notes(self.config)
    def test_version_mismatch(self):
        self.note.write_text(self.original.replace('version: "0.3.0-rc.1"','version: "0.3.0"'))
        with self.assertRaises(ValueError):p.release_notes(self.config)
    def test_stable_not_candidate(self):
        self.note.write_text(self.original.replace('release_status: "candidate"','release_status: "stable"'))
        with self.assertRaises(ValueError):p.release_notes(self.config)

class GitIntegrityTests(unittest.TestCase):
    def test_rejects_converted_index_and_accepts_preserved_bytes(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);p.run(['git','init','-q',temp])
            sample=root/'sample.properties';sample.write_bytes(b'key=value\r\n')
            p.run(['git','-c','core.autocrlf=input','add','sample.properties'],cwd=temp)
            with self.assertRaisesRegex(ValueError,'暂存内容与源文件不一致'):
                p.verify_staged_source(root,{'sample.properties':{}})
            (root/'.gitattributes').write_text('* -text\n')
            p.run(['git','-c','core.autocrlf=false','add','--renormalize','.'],cwd=temp)
            p.verify_staged_source(root,{'sample.properties':{}})

class RunnerTests(unittest.TestCase):
    def test_success(self):
        self.assertEqual(p.run([sys.executable,'-c','print("ok")']), 'ok')
    def test_failure_does_not_echo_output(self):
        with self.assertRaisesRegex(RuntimeError, '命令失败') as error:
            p.run([sys.executable,'-c','import sys; print("TEST_SECRET"); sys.exit(1)'])
        self.assertNotIn('TEST_SECRET',str(error.exception))
    def test_timeout(self):
        with self.assertRaisesRegex(RuntimeError, '超时或被中断'):
            p.run([sys.executable,'-c','import time; time.sleep(10)'],timeout=0.05)

if __name__=='__main__':unittest.main(verbosity=2)

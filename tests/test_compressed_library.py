import gzip
import hashlib
import json
import shutil
import sqlite3
import subprocess
import unittest
from pathlib import Path

import test_library_reader as fixtures
reader = fixtures.reader


class CompressedLibraryTests(unittest.TestCase):
    """复用资料夹具，不把继承的历史测试重复计数。"""
    setUp = fixtures.LibraryReaderTests.setUp
    add = fixtures.LibraryReaderTests.add
    finish = fixtures.LibraryReaderTests.finish
    rehash = fixtures.LibraryReaderTests.rehash
    reopen = fixtures.LibraryReaderTests.reopen
    object_path = fixtures.LibraryReaderTests.object_path
    full_manifest = fixtures.LibraryReaderTests.full_manifest
    save_manifest = fixtures.LibraryReaderTests.save_manifest
    compact = fixtures.LibraryReaderTests.compact

    def compress(self):
        self.compact()
        self.reopen()
        self.db.row_factory = sqlite3.Row
        self.db.execute('CREATE TABLE object_storage(object_path TEXT PRIMARY KEY,codec TEXT,stored_sha256 TEXT,stored_bytes INTEGER)')
        rows = list(self.db.execute('SELECT DISTINCT object_path FROM documents'))
        for row in rows:
            old = row['object_path']
            data = gzip.compress((self.root / old).read_bytes(), mtime=0)
            new = old + '.gz'
            (self.root / new).write_bytes(data)
            (self.root / old).unlink()
            self.db.execute('UPDATE documents SET object_path=? WHERE object_path=?', (new, old))
            self.db.execute('INSERT INTO object_storage VALUES(?,?,?,?)', (new, 'gzip', hashlib.sha256(data).hexdigest(), len(data)))
        manifest = json.loads((self.root / 'manifest.json').read_text())
        self.finish()
        manifest['catalog_sha256'] = hashlib.sha256((self.root / 'catalog.sqlite').read_bytes()).hexdigest()
        manifest['storage'] = {'compression': 'gzip-or-identity-per-object'}
        self.save_manifest(manifest)

    def test_compressed_read_search_verify(self):
        with reader.Library(self.root) as library:
            before = library.read('form')['text']
        self.compress()
        with reader.Library(self.root) as library:
            self.assertEqual(before, library.read('form')['text'])
            self.assertEqual(library.search('registerCheckEvent')['matched_documents'], 1)
            self.assertEqual(library.verify()['checked_documents'], 6)
            self.assertLess(library.stats()['stored_object_bytes'], 10000)

    def test_corrupt_compressed_object_rejected(self):
        self.compress()
        path = self.object_path('form')
        path.write_bytes(path.read_bytes()[:-4])
        with reader.Library(self.root) as library:
            with self.assertRaises(ValueError):
                library.read('form')

    def test_wrong_logical_size_rejected(self):
        self.compress()
        manifest = json.loads((self.root / 'manifest.json').read_text())
        self.reopen()
        self.db.execute("UPDATE documents SET output_bytes=2 WHERE id='form'")
        self.finish()
        manifest['catalog_sha256'] = hashlib.sha256((self.root / 'catalog.sqlite').read_bytes()).hexdigest()
        self.save_manifest(manifest)
        with reader.Library(self.root) as library:
            with self.assertRaises(ValueError):
                library.read('form')

    def test_export_binary_exact_and_no_clobber(self):
        self.compress()
        target_dir = self.base / 'outside'
        target_dir.mkdir()
        # Test package root is self.base; export must be outside it.
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp).resolve() / 'result.png'
            with reader.Library(self.root) as library:
                library.export('binary', target)
                self.assertEqual(target.read_bytes(), b'\x89PNG\x00\xff\x01')
                with self.assertRaises(ValueError):
                    library.export('binary', target)
                with self.assertRaises(ValueError):
                    library.export('binary', self.root / 'overwrite.png')

    def test_node_fallback_reads_relocated_compressed_text(self):
        if not shutil.which('node'):
            self.skipTest('Node unavailable')
        self.compress()
        package = self.base / 'Node中文 空格包'
        (package / 'scripts').mkdir(parents=True)
        shutil.copytree(self.root, package / 'library')
        script = Path(__file__).resolve().parents[1] / 'scripts/read_object.mjs'
        shutil.copyfile(script, package / 'scripts/read_object.mjs')
        relative = self.object_path('form').relative_to(self.root).as_posix()
        result = subprocess.run(['node', str(package / 'scripts/read_object.mjs'), relative], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('WfForm', json.loads(result.stdout)['text'])
        rejected = subprocess.run(['node', str(package / 'scripts/read_object.mjs'), '../manifest.json'], capture_output=True)
        self.assertNotEqual(rejected.returncode, 0)

    def test_general_development_prefers_body_over_dictionary(self):
        self.reopen()
        self.add('dev', '# 流程表单汇总\n明细 汇总 首次打开\n', 'E9/表单开发.md', 'E9')
        self.add('db-table', '# 明细汇总表\n明细 汇总 字段\n', 'E9/数据字典/汇总表.html', 'E9')
        self.finish()
        self.compact()
        with reader.Library(self.root) as library:
            self.assertEqual(library.search('明细 汇总')['results'][0]['document_id'], 'dev')
            self.assertIn('db-table', [r['document_id'] for r in library.search('明细 汇总')['results']])

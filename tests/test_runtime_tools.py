"""隔离离线验收：真实调用随包工具，验证产物、拒绝路径与网络禁用。"""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
import zipfile

PACKAGE = Path(__file__).resolve().parents[1]
TOOLS = PACKAGE / "tools" / "ecode"
NODE = shutil.which("node")
FRONTEND = "skills/ecode-development/modules/e10-frontend-local-tooling/scripts/ecodecmd-e10/bin/ecodecmd-e10.mjs"
BACKEND = "skills/ecode-development/modules/backend-project-init/scripts/project-validator.mjs"
INTEGRATION = "skills/ecode-integration/scripts/integration.mjs"


@unittest.skipUnless(NODE, "需要本地 Node.js；不自动安装")
class RuntimeToolsTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="cc-runtime-offline-")
        self.work = Path(self.temporary.name).resolve()
        self.guard = self.work / "no-network.mjs"
        self.guard.write_text("""import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
const deny=()=>{throw new Error('OFFLINE_TEST_NETWORK_FORBIDDEN');};
globalThis.fetch=deny;http.request=deny;http.get=deny;https.request=deny;https.get=deny;
net.Socket.prototype.connect=deny;
""", encoding="utf-8")

    def tearDown(self):
        self.temporary.cleanup()

    def run_tool(self, entry, *arguments, expected=0):
        # 故意去掉 zip/unzip 等系统工具的 PATH，验证打包不依赖 Unix 命令。
        env = {key: value for key, value in os.environ.items()
               if key in {"SYSTEMROOT", "WINDIR", "TEMP", "TMP", "TMPDIR"}}
        env["PATH"] = str(self.work / "empty-path")
        result = subprocess.run([NODE, "--import", str(self.guard), str(TOOLS / entry), *map(str, arguments)],
                                cwd=self.work, env=env, capture_output=True, text=True, timeout=45)
        self.assertEqual(result.returncode, expected, result.stdout + result.stderr)
        self.assertNotIn("OFFLINE_TEST_NETWORK_FORBIDDEN", result.stderr)
        return result

    def write_json(self, name, content):
        target = self.work / name
        target.write_text(json.dumps(content, ensure_ascii=False), encoding="utf-8")
        return target

    def test_runtime_inventory(self):
        manifest = json.loads((TOOLS / "manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(len(manifest["included_components"]), 7)
        actual = {file.relative_to(TOOLS).as_posix() for file in TOOLS.rglob("*") if file.is_file()}
        self.assertEqual(actual - {"manifest.json"}, {row["path"] for row in manifest["files"]})
        for row in manifest["files"]:
            with self.subTest(path=row["path"]):
                target = TOOLS / row["path"]
                self.assertNotIn(target.name.casefold(), {"skill.md", "agents.md", "claude.md"})
                self.assertEqual(hashlib.sha256(target.read_bytes()).hexdigest(), row["sha256"])

    def test_page_runtime_pinned_install_regressions(self):
        # 真实网络由上方预加载器禁止；node:test使用隔离合成包验证锁、失败恢复和权限边界。
        if not shutil.which('npm'):
            self.skipTest('页面依赖锁回归需要本机npm定位入口，但不执行真实安装')
        env = {key: value for key, value in os.environ.items()
               if key in {'PATH', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP', 'TMPDIR'}}
        result = subprocess.run([NODE, '--import', str(self.guard), '--test', '--test-reporter=tap',
                                 str(TOOLS / 'skills/weaver-e10-page-generator/scripts/runtime.test.mjs')],
                                cwd=self.work, env=env, capture_output=True, text=True, timeout=45)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertNotIn('OFFLINE_TEST_NETWORK_FORBIDDEN', result.stderr)
        self.assertIn('# fail 0', result.stdout)

    def test_frontend_four_types_compile_and_package(self):
        types = [None, "eb-custom-component", "business-component", "feature-theme"]
        for app_type in types:
            with self.subTest(app_type=app_type):
                name = app_type or "react-patch"
                options = ["--app-type", app_type] if app_type else []
                self.run_tool(FRONTEND, "init", self.work, "--project-name", name, *options)
                project = self.work / name
                (project / "cc-page.js").write_text("export default function Page(){return <div>CC 示例</div>;}\n", encoding="utf-8")
                (project / "resources" / "中文.txt").write_text("独立打包资源", encoding="utf-8")
                self.run_tool(FRONTEND, "check", project)
                self.run_tool(FRONTEND, "compile", project)
                self.run_tool(FRONTEND, "build", project)
                outputs = list((project / ".target").glob("*.zip"))
                self.assertEqual(len(outputs), 1)
                with zipfile.ZipFile(outputs[0]) as archive:
                    self.assertIsNone(archive.testzip())
                    metadata_file = next(n for n in archive.namelist() if n.endswith("/ecode.json"))
                    patch = json.loads(archive.read(metadata_file))
                    self.assertTrue(any(code["name"] == "cc-page" for code in patch["codes"]))
                    resource = next(n for n in archive.namelist() if n.endswith("中文.txt"))
                    self.assertEqual(archive.read(resource).decode(), "独立打包资源")
                    if app_type in {"eb-custom-component", "feature-theme"}:
                        entry = next(code for code in patch["codes"] if code["name"] == "entry")
                        self.assertEqual((entry["content"], entry["compiledContent"]), ("", ""))
                self.run_tool(FRONTEND, "init", self.work, "--project-name", name, *options, expected=1)

    def test_frontend_failed_validation_preserves_old_artifacts(self):
        self.run_tool(FRONTEND, "init", self.work, "--project-name", "eb", "--app-type", "eb-custom-component")
        project = self.work / "eb"
        self.run_tool(FRONTEND, "build", project)
        output = next((project / ".target").glob("*.zip"))
        original = output.read_bytes()
        unrelated = project / ".target" / "other-project.zip"
        unrelated.write_bytes(b"unrelated-existing-artifact")
        (project / "entry.js").write_text("console.log('not allowed');", encoding="utf-8")
        self.run_tool(FRONTEND, "build", project, expected=1)
        self.assertEqual(output.read_bytes(), original)
        self.assertEqual(unrelated.read_bytes(), b"unrelated-existing-artifact")
        (project / "entry.js").write_text("", encoding="utf-8")
        self.run_tool(FRONTEND, "build", project)
        backups = list((project / ".target").glob("*.ecodecmd-backup"))
        self.assertEqual(len(backups), 1)
        self.assertEqual(backups[0].read_bytes(), original)
        self.assertEqual(unrelated.read_bytes(), b"unrelated-existing-artifact")

    def test_backend_skeleton_create_module_and_dependency_boundary(self):
        project = self.work / "backend"
        result = self.run_tool(BACKEND, "init", project, "--module", "secondev-demo", "--skeleton-only")
        self.assertTrue(json.loads(result.stdout)["projectInitialized"])
        self.assertTrue((project / "settings.gradle").is_file())
        self.run_tool(BACKEND, "create-module", project, "--module", "secondev-orders")
        self.assertTrue((project / "secondev-orders" / "secondev-orders.gradle").is_file())
        self.run_tool(BACKEND, "create-module", project, "--module", "secondev-orders")
        inspection = json.loads(self.run_tool(BACKEND, "inspect", project, "--module", "secondev-orders", expected=2).stdout)
        self.assertFalse(inspection["dependencyInitialized"])
        self.assertFalse(inspection["buildVerified"])

    def test_security_and_performance_contract_valid_invalid_and_stale(self):
        artifact = self.work / "example.js"
        artifact.write_text("export const value = 1;\n", encoding="utf-8")
        for domain in ["SECURITY", "PERFORMANCE"]:
            with self.subTest(domain=domain):
                entry = "skills/ecode-" + domain.lower() + "-review/scripts/review-contract.mjs"
                prepared = self.work / (domain + "-input.json")
                self.run_tool(entry, "prepare", "--stage", "FILE_SAVE", "--artifact", artifact, "--out", prepared)
                report = json.loads(prepared.read_text())
                report.update({"decision": "PASS", "riskState": "CLEAN", "assuranceLevel": "STATIC_ONLY",
                               "findings": [], "rulesApplied": ["TEST-CONTRACT-ONLY"], "rulesSkipped": [],
                               "verificationNeeded": [], "errors": [], "summary": {"filesReviewed": 1}})
                if domain == "SECURITY":
                    report["checklistResults"] = []
                    report["summary"].update({"findingCount": 0, "passCount": 0, "failCount": 0, "naCount": 0, "unverifiedCount": 0})
                else:
                    report["runtimeValidationStatus"] = "NOT_PROVIDED"
                    report["summary"].update({"errorCount": 0, "warnCount": 0, "policyCount": 0, "performanceRiskCount": 0})
                output = self.write_json(domain + "-output.json", report)
                self.run_tool(entry, "validate", "--output", output, "--input", prepared, "--artifact", artifact)
                report["summary"]["filesReviewed"] = 7
                bad = self.write_json(domain + "-bad.json", report)
                self.run_tool(entry, "validate", "--output", bad, "--input", prepared, "--artifact", artifact, expected=1)
                artifact.write_text("export const value = 2;\n", encoding="utf-8")
                self.run_tool(entry, "validate", "--output", output, "--input", prepared, "--artifact", artifact, expected=1)
                artifact.write_text("export const value = 1;\n", encoding="utf-8")

    def test_integration_offline_plan_dry_run_and_changed_plan(self):
        config = json.loads((TOOLS / "skills/ecode-integration/assets/config.example.json").read_text())
        config["e10"].update({"baseline": "TEST-NONPRODUCTION", "contractEvidence": "local synthetic fixture", "operatorId": "test-operator"})
        config["sync"].update({"subcompanyIds": ["1"], "orgStatus": "1", "positionCanceled": "0", "statusMap": {"1": "1"}})
        snapshot = {"origin": config["e9"]["origin"], "subcompany": [{"id": "1", "subcompanyname": "测试分部"}],
                    "department": [{"id": "2", "subcompanyid1": "1", "departmentname": "测试部门"}],
                    "position": [{"id": "3", "jobtitlename": "测试岗位", "jobdepartmentid": "2"}],
                    "employee": [{"id": "4", "workcode": "TEST001", "lastname": "测试人员", "departmentid": "2", "jobtitle": "3", "status": "1"}]}
        config_file = self.write_json("integration-config.json", config)
        snapshot_file = self.write_json("integration-snapshot.json", snapshot)
        plan_file = self.work / "integration-plan.json"
        planned = json.loads(self.run_tool(INTEGRATION, "sync", "plan", "--config", config_file,
                                           "--snapshot", snapshot_file, "--out", plan_file).stdout)
        self.assertEqual((planned["recordCount"], planned["networkRequests"]), (4, 0))
        result = json.loads(self.run_tool(INTEGRATION, "sync", "apply", "--config", config_file,
                                          "--plan", plan_file, "--dry-run").stdout)
        self.assertEqual((result["mode"], result["networkRequests"]), ("dry-run", 0))
        changed = json.loads(plan_file.read_text())
        changed["recordCount"] += 1
        invalid = self.write_json("changed-plan.json", changed)
        result = self.run_tool(INTEGRATION, "sync", "apply", "--config", config_file,
                               "--plan", invalid, "--dry-run", expected=1)
        self.assertIn("PLAN_CHANGED", result.stderr)

    def test_platform_local_output_and_default_session_boundary(self):
        # 只验证本地落盘策略；固定内存客户端不代表远端 API 验收。
        entry = self.work / "platform-local-unit.mjs"
        imports = {
            "cli": (TOOLS / "skills/ecode-cli/scripts/ecode-cli.mjs").as_uri(),
            "login": (TOOLS / "skills/e10-login-cli/scripts/e10-login-cli.mjs").as_uri(),
            "auth": (TOOLS / "skills/ecode-cli/scripts/lib/auth.mjs").as_uri(),
            "page": (TOOLS / "skills/weaver-e10-page-generator/scripts/page-agent.mjs").as_uri(),
        }
        entry.write_text("""import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const urls = """ + json.dumps(imports) + ";\n" + """
const {main}=await import(urls.cli);
const {parseArguments}=await import(urls.login);
const {DEFAULT_STATE_PATH}=await import(urls.auth);
const {parseInvocation}=await import(urls.page);
assert.equal(parseArguments(['current']).statePath,DEFAULT_STATE_PATH);
assert.equal(parseInvocation(['status']).statePath,DEFAULT_STATE_PATH);
assert.ok(DEFAULT_STATE_PATH.includes('.weaver-cc-assistant'));
assert.ok(!DEFAULT_STATE_PATH.includes('/tools/ecode/'));
const client={
 projectList:async()=>({data:{list:[{id:'99',projectName:'fixture'}]}}),
 treeList:async id=>id==='99'?{data:{folders:[{id:'1',name:'downloaded',appUUID:'100'}]}}:{data:{codes:[{id:'2',name:'entry',extension:'js'}],folders:[],resources:[]}},
 fileGet:async()=>({data:{content:Buffer.from('export const saved = 1;').toString('base64')}})
};
let messages='';const deps={client,loadSession:()=>({}),stdout:{write:text=>messages+=text}};
assert.equal(await main(['app','download','--app-id','1','--output',process.cwd()],deps),0);
const target=path.join(process.cwd(),'downloaded/entry.js');
await fs.writeFile(target,'user local changes');
assert.notEqual(await main(['app','download','--app-id','1','--output',process.cwd()],deps),0);
assert.equal(await fs.readFile(target,'utf8'),'user local changes');
assert.notEqual(await main(['file','get','--id','2','--source-out',target],deps),0);
assert.equal(await fs.readFile(target,'utf8'),'user local changes');
const fresh=path.join(process.cwd(),'new-file.js');
assert.equal(await main(['file','get','--id','2','--source-out',fresh],deps),0);
assert.equal(await fs.readFile(fresh,'utf8'),'export const saved = 1;');
""", encoding="utf-8")
        result = subprocess.run([NODE, "--import", str(self.guard), str(entry)], cwd=self.work,
                                capture_output=True, text=True, timeout=30)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_first_local_page_run_never_reads_or_synchronizes_existing_session(self):
        # 保持 page-agent 主流程逐字不变，仅在临时树中替换外部边界。
        # 即使旧实现吞掉同步错误，session-read 轨迹仍会使测试失败。
        scripts = self.work / "skills/weaver-e10-page-generator/scripts"
        scripts.mkdir(parents=True)
        page_source = TOOLS / "skills/weaver-e10-page-generator/scripts/page-agent.mjs"
        (scripts / "page-agent.mjs").write_bytes(page_source.read_bytes())
        trace = self.work / "page-trace.jsonl"
        marker = """import {appendFileSync} from 'node:fs';
const mark=(event,details={})=>appendFileSync(process.env.CC_TEST_TRACE,JSON.stringify({event,...details})+'\\n');
"""
        (scripts / "runtime.mjs").write_text(marker + """
export function runtimeRoot(){return process.env.CC_TEST_RUNTIME;}
export async function inspectRuntime(){mark('inspect-not-installed');return {status:'not-installed'};}
export async function ensureRuntime(){mark('first-install');return {status:'installed',version:'0.0.0-test',packageRoot:process.env.CC_TEST_RUNTIME};}
export function protocolPaths(){return {};}
export function runtimeEnvironment(root,env=process.env,authenticated=false){return {...env,CC_TEST_AUTHENTICATED:String(authenticated),UI_CODE_AGENT_HOME:root+(authenticated?'/state':'/local-state')};}
""", encoding="utf-8")
        (scripts / "session-bridge.mjs").write_text(marker + """
export async function invalidatePageAuth(){mark('invalidate');}
export async function syncSession(){mark('synchronize');return {status:'synchronized',baseUrl:'https://fixture.invalid',tenantKey:'fixture',userId:'fixture'};}
export async function withPageSessionLock(root,work){return await work();}
""", encoding="utf-8")
        (scripts / "approval.mjs").write_text("export const approvalPlan=async()=>({}); export const consumeApproval=async()=>{};", encoding="utf-8")
        (scripts / "data-write.mjs").write_text("export function validateDataWrite(){}", encoding="utf-8")
        (scripts / "launch-ui-code-agent.mjs").write_text(marker + "mark('child-run',{authenticated:process.env.CC_TEST_AUTHENTICATED,profile:process.env.UI_CODE_AGENT_HOME});", encoding="utf-8")
        login = self.work / "skills/e10-login-cli/scripts/e10-login-cli.mjs"
        login.parent.mkdir(parents=True)
        login.write_text(marker + """
export async function pageAgentSessionContext(){
 mark('session-read');
 if(process.env.CC_TEST_SESSION_FAIL==='1')throw new Error('synthetic historical session failure');
 return {session:{},expectedTenant:'fixture',expectedUser:'fixture'};
}
""", encoding="utf-8")
        env = dict(os.environ, CC_TEST_TRACE=str(trace), CC_TEST_RUNTIME=str(self.work / "fake-runtime"))
        for arguments in [["run", "--", "init", "--name", "fixture"], ["run", "--", "next"]]:
            for fail in ["0", "1"]:
                with self.subTest(arguments=arguments, historical_session_fails=fail):
                    trace.write_text("", encoding="utf-8")
                    result = subprocess.run([NODE, "--import", str(self.guard), str(scripts / "page-agent.mjs"), *arguments],
                                            cwd=self.work, env=dict(env, CC_TEST_SESSION_FAIL=fail),
                                            capture_output=True, text=True, timeout=30)
                    self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                    events = [json.loads(line) for line in trace.read_text().splitlines()]
                    self.assertEqual([event["event"] for event in events], ["first-install", "child-run"])
                    self.assertEqual(events[-1]["authenticated"], "false")
                    self.assertTrue(events[-1]["profile"].endswith("/local-state"))
        # 对照：显式身份/平台读取仍进入同步，证明测试双桩没有掩盖真实调用。
        for arguments in [["sync"], ["run", "--", "auth", "status"], ["run", "--", "platform", "projects"]]:
            with self.subTest(explicit_operation=arguments):
                trace.write_text("", encoding="utf-8")
                result = subprocess.run([NODE, "--import", str(self.guard), str(scripts / "page-agent.mjs"), *arguments],
                                        cwd=self.work, env=dict(env, CC_TEST_SESSION_FAIL="0"),
                                        capture_output=True, text=True, timeout=30)
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                events = [json.loads(line)["event"] for line in trace.read_text().splitlines()]
                self.assertEqual(events.count("session-read"), 1)
                self.assertEqual(events.count("synchronize"), 1)


if __name__ == "__main__":
    unittest.main()

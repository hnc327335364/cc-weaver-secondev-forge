import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';

export class SessionSecurityError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'SessionSecurityError';
    this.code = code;
  }
}

const INSPECT_ACL = String.raw`
$ErrorActionPreference = 'Stop'
$path = [IO.Path]::GetFullPath($env:ECODE_SESSION_PATH)
$item = Get-Item -LiteralPath $path -Force
$acl = Get-Acl -LiteralPath $path
$current = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$owner = ([Security.Principal.NTAccount]$acl.Owner).Translate([Security.Principal.SecurityIdentifier]).Value
$allowed = @($current, 'S-1-5-18', 'S-1-5-32-544')
$broad = @()
foreach ($rule in @($acl.Access)) {
  if ($rule.AccessControlType -ne [Security.AccessControl.AccessControlType]::Allow) { continue }
  $sid = $rule.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value
  if ($allowed -notcontains $sid) { $broad += $sid }
}
[pscustomobject]@{
  ownerSid = $owner
  currentUserSid = $current
  protected = [bool]$acl.AreAccessRulesProtected
  broadAllowSids = @($broad | Select-Object -Unique)
  reparsePoint = [bool](($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0)
} | ConvertTo-Json -Compress
`;

const SECURE_ACL = String.raw`
$ErrorActionPreference = 'Stop'
$path = [IO.Path]::GetFullPath($env:ECODE_SESSION_PATH)
$item = Get-Item -LiteralPath $path -Force
if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'SESSION_REPARSE_POINT' }
$current = [Security.Principal.WindowsIdentity]::GetCurrent().User
$system = New-Object Security.Principal.SecurityIdentifier('S-1-5-18')
$admins = New-Object Security.Principal.SecurityIdentifier('S-1-5-32-544')
$acl = Get-Acl -LiteralPath $path
$acl.SetAccessRuleProtection($true, $false)
foreach ($rule in @($acl.Access)) { [void]$acl.RemoveAccessRuleSpecific($rule) }
$acl.SetOwner($current)
foreach ($identity in @($current, $system, $admins)) {
  $rule = New-Object Security.AccessControl.FileSystemAccessRule($identity, 'FullControl', 'Allow')
  [void]$acl.AddAccessRule($rule)
}
Set-Acl -LiteralPath $path -AclObject $acl
`;

function runPowerShell(script, path, execFile = execFileSync) {
  const options = {
    encoding: 'utf8',
    windowsHide: true,
    env: { ...process.env, ECODE_SESSION_PATH: path },
    stdio: ['ignore', 'pipe', 'pipe'],
  };
  try {
    return execFile('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], options);
  } catch (error) {
    throw new SessionSecurityError('ACL_UNVERIFIED', `Windows session ACL could not be verified: ${error?.code || 'PowerShell failure'}`);
  }
}

export function validateWindowsAcl(report) {
  const broad = Array.isArray(report?.broadAllowSids)
    ? report.broadAllowSids
    : report?.broadAllowSids ? [report.broadAllowSids] : [];
  if (!report || report.reparsePoint) throw new SessionSecurityError('INSECURE', 'Windows session path must not be a reparse point');
  if (!report.currentUserSid || report.ownerSid !== report.currentUserSid) {
    throw new SessionSecurityError('INSECURE', 'Windows session owner is not the current user');
  }
  if (report.protected !== true) throw new SessionSecurityError('INSECURE', 'Windows session ACL inheritance is enabled');
  if (broad.length) throw new SessionSecurityError('INSECURE', `Windows session ACL grants access to unapproved principals: ${broad.join(',')}`);
  return true;
}

export function inspectWindowsAcl(path, { execFile = execFileSync } = {}) {
  const raw = runPowerShell(INSPECT_ACL, path, execFile);
  try {
    return JSON.parse(String(raw).trim());
  } catch {
    throw new SessionSecurityError('ACL_UNVERIFIED', 'Windows session ACL inspection returned invalid data');
  }
}

export function assertSessionFileSecurity(path, {
  platform = process.platform,
  stat = statSync,
  inspectAcl = inspectWindowsAcl,
} = {}) {
  const file = stat(path);
  if (!file.isFile()) throw new SessionSecurityError('INVALID', 'Session path is not a file');
  if (platform === 'win32') return validateWindowsAcl(inspectAcl(path));
  if ((file.mode & 0o777) !== 0o600) throw new SessionSecurityError('INSECURE', '会话文件权限错误，必须为0600');
  return true;
}

export function secureWindowsSessionFile(path, { platform = process.platform, execFile = execFileSync, stat = statSync } = {}) {
  if (platform !== 'win32') return;
  const before = inspectWindowsAcl(path, { execFile });
  if (before?.reparsePoint || !before?.currentUserSid || before.ownerSid !== before.currentUserSid) {
    throw new SessionSecurityError('INSECURE', 'Windows session must already be owned by the current user and must not be a reparse point');
  }
  runPowerShell(SECURE_ACL, path, execFile);
  assertSessionFileSecurity(path, { platform, stat, inspectAcl: target => inspectWindowsAcl(target, { execFile }) });
}

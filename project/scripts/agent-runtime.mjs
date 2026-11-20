import { execFileSync } from 'node:child_process';

const OPENCODE_EXECUTABLE = /(?:^|[\\/\s"'])opencode(?:\.exe|\.cmd|\.bat)?(?:$|[\s"'])/i;

export function detectAgentRuntime(options = {}) {
  const env = options.env || process.env;
  const explicit = normalizeRuntime(env.DASHI_PPT_AGENT_RUNTIME || env.DASHI_PPT_AGENT);
  if (explicit) return explicit;

  if (
    truthyIdentity(env.OPENCODE)
    || truthyIdentity(env.OPENCODE_AGENT)
    || truthyIdentity(env.OPENCODE_CLIENT)
    || truthyIdentity(env.OPENCODE_RUNTIME)
    || truthyIdentity(env.OPENCODE_SESSION_ID)
    || String(env.TERM_PROGRAM || '').trim().toLowerCase() === 'opencode'
  ) {
    return 'opencode';
  }

  const modulePath = String(options.modulePath || process.argv[1] || '').replace(/\\/g, '/').toLowerCase();
  if (/(?:^|\/)\.opencode\/skills\//.test(modulePath) || /(?:^|\/)\.config\/opencode\/skills\//.test(modulePath)) {
    return 'opencode';
  }

  const commandLines = options.ancestorCommandLines
    ?? readAncestorCommandLines(options.platform || process.platform, options.pid || process.ppid);
  return commandLines.some(commandLine => OPENCODE_EXECUTABLE.test(String(commandLine || '')))
    ? 'opencode'
    : 'other';
}

export function readAncestorCommandLines(platform = process.platform, startPid = process.ppid) {
  if (!Number.isInteger(startPid) || startPid <= 0) return [];
  return platform === 'win32'
    ? readWindowsAncestorCommandLines(startPid)
    : readPosixAncestorCommandLines(startPid);
}

function readWindowsAncestorCommandLines(startPid) {
  const script = [
    `$pidCursor=${startPid}`,
    '$seen=@{}',
    'for($i=0;$i -lt 12 -and $pidCursor -gt 0;$i++){',
    'if($seen.ContainsKey($pidCursor)){break}',
    '$seen[$pidCursor]=$true',
    "$p=Get-CimInstance Win32_Process -Filter ('ProcessId=' + $pidCursor) -ErrorAction SilentlyContinue",
    'if($null -eq $p){break}',
    '[Console]::Out.WriteLine(($p.CommandLine -replace "`r|`n", " "))',
    '$pidCursor=[int]$p.ParentProcessId',
    '}',
  ].join(';');
  try {
    return execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 1500,
      windowsHide: true,
    }).split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function readPosixAncestorCommandLines(startPid) {
  const commandLines = [];
  const seen = new Set();
  let pid = startPid;
  for (let depth = 0; depth < 12 && Number.isInteger(pid) && pid > 0 && !seen.has(pid); depth += 1) {
    seen.add(pid);
    try {
      const output = execFileSync('ps', ['-p', String(pid), '-o', 'ppid=', '-o', 'command='], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 1000,
      }).trim();
      const match = output.match(/^\s*(\d+)\s+([\s\S]*)$/);
      if (!match) break;
      commandLines.push(match[2].trim());
      pid = Number(match[1]);
    } catch {
      break;
    }
  }
  return commandLines.filter(Boolean);
}

function normalizeRuntime(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  return ['opencode', 'open-code'].includes(normalized) ? 'opencode' : 'other';
}

function truthyIdentity(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return Boolean(normalized) && !['0', 'false', 'no', 'off'].includes(normalized);
}

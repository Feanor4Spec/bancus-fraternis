import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const root = process.cwd();
const reportPath = path.join(root, 'docs', 'test-reports', 'local-sql-environment-report.json');

const cliTools = [
  { name: 'psql', provider: 'postgresql' },
  { name: 'mysql', provider: 'mysql' },
  { name: 'sqlcmd', provider: 'mssql' },
  { name: 'sqlite3', provider: 'sqlite' },
  { name: 'node', provider: 'runtime' },
  { name: 'npm', provider: 'runtime' }
];

const ports = [
  { provider: 'postgresql', label: 'PostgreSQL', host: '127.0.0.1', port: 5432 },
  { provider: 'mysql', label: 'MySQL/MariaDB', host: '127.0.0.1', port: 3306 },
  { provider: 'mssql', label: 'SQL Server', host: '127.0.0.1', port: 1433 },
  { provider: 'bancus-node', label: 'Bancus Node server', host: '127.0.0.1', port: Number(process.env.PORT || 8081) },
  { provider: 'local-http', label: 'Local HTTP 8080', host: '127.0.0.1', port: 8080 }
];

function normalizeLines(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function safeExecutableLabel(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return path.basename(text);
}

async function commandInfo(tool) {
  const command = process.platform === 'win32' ? 'where.exe' : 'command';
  const args = process.platform === 'win32' ? [tool.name] : ['-v', tool.name];
  try {
    const { stdout } = await execFileAsync(command, args, { timeout: 2500 });
    const matches = normalizeLines(stdout).map(safeExecutableLabel);
    return { ...tool, installed: matches.length > 0, paths: matches };
  } catch (error) {
    return { ...tool, installed: false, paths: [] };
  }
}

function checkPort(target) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: target.host, port: target.port });
    const done = (listening, error = '') => {
      socket.removeAllListeners();
      socket.destroy();
      resolve({ ...target, listening, error });
    };
    socket.setTimeout(800);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false, 'timeout'));
    socket.once('error', (error) => done(false, error.code || 'connection-error'));
  });
}

async function windowsSqlServices() {
  if (process.platform !== 'win32') return [];
  const script = [
    'Get-Service',
    "| Where-Object { $_.Name -match 'postgres|mysql|maria|mssql|sql' -or $_.DisplayName -match 'Postgre|MySQL|Maria|SQL Server|MSSQL' }",
    '| Select-Object Name,DisplayName,Status,StartType',
    '| ConvertTo-Json -Compress'
  ].join(' ');

  try {
    const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', script], { timeout: 5000 });
    if (!stdout.trim()) return [];
    const parsed = JSON.parse(stdout);
    return (Array.isArray(parsed) ? parsed : [parsed]).map((service) => ({
      name: service.Name || '',
      displayName: service.DisplayName || '',
      status: service.Status || '',
      startType: service.StartType || ''
    }));
  } catch (error) {
    return [];
  }
}

const [commands, portChecks, services] = await Promise.all([
  Promise.all(cliTools.map(commandInfo)),
  Promise.all(ports.map(checkPort)),
  windowsSqlServices()
]);

const externalListening = portChecks.filter((item) => ['postgresql', 'mysql', 'mssql'].includes(item.provider) && item.listening);
const installedExternalCli = commands.filter((item) => ['postgresql', 'mysql', 'mssql'].includes(item.provider) && item.installed);
const runningServices = services.filter((service) => String(service.status).toLowerCase() === 'running');

const report = {
  ok: true,
  generatedAt: new Date().toISOString(),
  runtime: {
    node: process.versions.node,
    platform: process.platform
  },
  summary: {
    activeExternalSqlServers: externalListening.length,
    installedExternalSqlCliTools: installedExternalCli.length,
    runningSqlServices: runningServices.length,
    bancusNodeListening: portChecks.some((item) => item.provider === 'bancus-node' && item.listening)
  },
  cliTools: commands,
  ports: portChecks,
  services,
  recommendation: externalListening.length
    ? 'Servidor SQL externo detectado em porta padrao; proximo ciclo pode criar adapter configuravel por provider.'
    : 'Nenhum PostgreSQL/MySQL/SQL Server escutando em porta padrao; manter SQLite ativo e validar instalacao do servidor antes de trocar provider.'
};

await fs.mkdir(path.dirname(reportPath), { recursive: true });
await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

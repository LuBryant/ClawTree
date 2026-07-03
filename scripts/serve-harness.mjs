import { access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '..');
const nextCli = path.join(root, 'frontend', 'node_modules', 'next', 'dist', 'bin', 'next');
const port = Number(process.env.HARNESS_PORT || 3334);

try {
  await access(nextCli);
} catch {
  console.error('Missing frontend dependencies. Run: npm run install');
  process.exit(1);
}

const child = spawn(process.execPath, [nextCli, 'dev', '--hostname', '127.0.0.1', '--port', String(port)], {
  cwd: path.join(root, 'frontend'),
  env: { ...process.env, NEXT_DIST_DIR: '.next-harness', NEXT_TELEMETRY_DISABLED: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
});

child.stdout.on('data', (chunk) => process.stdout.write(chunk));
child.stderr.on('data', (chunk) => process.stderr.write(chunk));
child.on('exit', (code) => process.exit(code ?? 0));

function shutdown() {
  child.kill('SIGTERM');
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

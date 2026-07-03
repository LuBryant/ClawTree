import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reportPath = path.join(root, 'docs', 'harness-preflight-report.json');

const steps = [
  { name: 'docs:check', command: 'npm run docs:check' },
  { name: 'harness:matrix', command: 'npm run harness:matrix' },
  { name: 'flight:test', command: 'npm run flight:test' },
  { name: 'secret:scan:source', command: 'npm run secret:scan:source' },
  { name: 'secret:scan:diff', command: 'npm run secret:scan:diff' },
  { name: 'test', command: 'npm run test' },
  { name: 'frontend:check', command: 'npm --prefix frontend run check' },
  { name: 'secret:scan:bundle', command: 'npm run secret:scan:bundle' },
  { name: 'smoke', command: 'npm run smoke' },
];

function run(command) {
  const started = Date.now();
  const result = spawnSync(command, {
    cwd: root,
    encoding: 'utf8',
    shell: true,
    maxBuffer: 30 * 1024 * 1024,
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: '1',
    },
  });
  const output = String((result.stdout || '') + (result.stderr || ''));
  return {
    command,
    exitCode: typeof result.status === 'number' ? result.status : 1,
    durationMs: Date.now() - started,
    outputTail: output.slice(-12000),
    error: result.error ? result.error.message : null,
  };
}

const report = {
  generatedAt: new Date().toISOString(),
  cwd: root,
  platform: {
    os: os.platform(),
    release: os.release(),
    arch: os.arch(),
    node: process.version,
  },
  steps: [],
  summary: {
    passed: 0,
    failed: 0,
  },
};

let failed = false;
for (const step of steps) {
  console.log('PREFLIGHT RUN ' + step.name);
  const result = run(step.command);
  report.steps.push({ name: step.name, ...result });
  if (result.exitCode === 0) {
    report.summary.passed += 1;
    console.log('PREFLIGHT PASS ' + step.name + ' (' + result.durationMs + 'ms)');
  } else {
    report.summary.failed += 1;
    failed = true;
    console.error('PREFLIGHT FAIL ' + step.name + ' (' + result.durationMs + 'ms)');
    console.error(result.outputTail);
    break;
  }
}

writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
console.log('PREFLIGHT REPORT ' + path.relative(root, reportPath).replaceAll('\\', '/'));

if (failed) process.exit(1);
console.log('PREFLIGHT PASS');

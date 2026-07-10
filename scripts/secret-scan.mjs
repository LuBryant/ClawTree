import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAX_FILE_BYTES = 20 * 1024 * 1024;

const signatures = [
  { id: 'provider-api-key', pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { id: 'github-token', pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g },
  { id: 'aws-access-key', pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g },
  { id: 'private-key', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  {
    id: 'credential-url',
    pattern: /\b(?:mysql|mariadb|postgres(?:ql)?|mongodb(?:\+srv)?):\/\/[^\s:/"']+:[^\s/@"']+@/gi,
  },
  {
    id: 'hardcoded-secret-assignment',
    pattern: /\b(?:API_KEY|SECRET_KEY|PASSWORD|PRIVATE_KEY|ACCESS_TOKEN)\b\s*[:=]\s*["'][^"'\r\n]{8,}["']/gi,
  },
];

function lineNumber(text, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) if (text.charCodeAt(i) === 10) line += 1;
  return line;
}

export function scanText(text, file = '<memory>') {
  const findings = [];
  for (const { id, pattern } of signatures) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      findings.push({ file, line: lineNumber(text, match.index ?? 0), rule: id });
    }
  }
  return findings;
}

export function addedLinesFromDiff(diff) {
  return diff
    .split(/\r?\n/)
    .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
    .map((line) => line.slice(1))
    .join('\n');
}

function git(args) {
  return execFileSync(
    'git',
    ['-c', `safe.directory=${root.replaceAll('\\', '/')}`, ...args],
    { cwd: root, encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 },
  );
}

function scanFile(file) {
  const relativePath = path.relative(root, file).replaceAll('\\', '/');
  if (relativePath.split('/').some((segment) => segment === '.venv' || segment === 'node_modules')) return [];
  if (/^\.env(?:\.|$)/.test(relativePath) && !relativePath.endsWith('.example')) return [];
  const stats = statSync(file);
  if (!stats.isFile() || stats.size > MAX_FILE_BYTES) return [];
  const buffer = readFileSync(file);
  const sample = buffer.subarray(0, Math.min(buffer.length, 8_192));
  if (sample.includes(0)) return [];
  return scanText(buffer.toString('utf8'), path.relative(root, file));
}

function sourceFiles() {
  const output = git(['ls-files', '--cached', '--others', '--exclude-standard', '-z']);
  return output.split('\0').filter(Boolean).map((file) => path.join(root, file));
}

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(absolute));
    else files.push(absolute);
  }
  return files;
}

function scanSource() {
  return sourceFiles().flatMap(scanFile);
}

function scanDiff() {
  const working = addedLinesFromDiff(git(['diff', '--no-ext-diff', '--unified=0', '--', '.']));
  const staged = addedLinesFromDiff(git(['diff', '--cached', '--no-ext-diff', '--unified=0', '--', '.']));
  return [
    ...scanText(working, '<git-working-diff>'),
    ...scanText(staged, '<git-staged-diff>'),
  ];
}

function scanBundle() {
  const directory = path.join(root, 'frontend', '.next');
  try {
    return walk(directory).flatMap(scanFile);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      throw new Error('Production bundle not found. Run the frontend build before bundle scan.');
    }
    throw error;
  }
}

function report(findings, scope) {
  if (findings.length === 0) {
    console.log(`SECRET SCAN PASS (${scope})`);
    return;
  }
  console.error(`SECRET SCAN FAIL (${scope}): ${findings.length} potential secret(s)`);
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} [${finding.rule}] value redacted`);
  }
  process.exitCode = 1;
}

if (process.argv[1] && path.basename(process.argv[1]).toLowerCase() === 'secret-scan.mjs') {
  const scope = process.argv[2] || 'all';
  if (!['source', 'diff', 'bundle', 'all'].includes(scope)) {
    console.error('Usage: node scripts/secret-scan.mjs [source|diff|bundle|all]');
    process.exitCode = 2;
  } else {
    const findings = [];
    if (scope === 'source' || scope === 'all') findings.push(...scanSource());
    if (scope === 'diff' || scope === 'all') findings.push(...scanDiff());
    if (scope === 'bundle' || scope === 'all') findings.push(...scanBundle());
    report(findings, scope);
  }
}

import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fence = String.fromCharCode(96).repeat(3);

function walk(directory, predicate, acc = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute, predicate, acc);
    else if (predicate(absolute)) acc.push(absolute);
  }
  return acc;
}

const markdownFiles = [
  path.join(root, 'README.md'),
  ...walk(path.join(root, 'docs'), (file) => file.endsWith('.md')),
];

const routeFiles = {
  '/': 'frontend/app/page.tsx',
  '/demo': 'frontend/app/demo/page.tsx',
  '/user': 'frontend/app/user/page.tsx',
  '/user/signals': 'frontend/app/user/signals/page.tsx',
  '/user/events': 'frontend/app/user/events/page.tsx',
  '/user/recaps': 'frontend/app/user/recaps/page.tsx',
  '/user/about': 'frontend/app/user/about/page.tsx',
  '/user/cooperate': 'frontend/app/user/cooperate/page.tsx',
  '/admin': 'frontend/app/admin/page.tsx',
  '/admin/events': 'frontend/app/admin/events/page.tsx',
  '/admin/reviews': 'frontend/app/admin/reviews/page.tsx',
  '/admin/ingestion': 'frontend/app/admin/ingestion/page.tsx',
  '/admin/content': 'frontend/app/admin/content/page.tsx',
  '/admin/proposals': 'frontend/app/admin/proposals/page.tsx',
  '/admin/outreach': 'frontend/app/admin/outreach/page.tsx',
};

const failures = [];

for (const file of markdownFiles) {
  const text = readFileSync(file, 'utf8');
  const relative = path.relative(root, file).replaceAll('\\', '/');
  const fenceCount = text.split(fence).length - 1;
  if (fenceCount % 2 !== 0) failures.push(relative + ': unbalanced fenced code block');

  for (const match of text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const rawTarget = match[1].trim();
    if (/^(?:https?:|mailto:|#|::)/i.test(rawTarget)) continue;
    const target = rawTarget.replace(/^<|>$/g, '').split('#')[0].split(':')[0];
    if (!target || target.startsWith('/')) continue;
    const resolved = path.resolve(path.dirname(file), target);
    try {
      if (!statSync(resolved).isFile()) failures.push(relative + ': link target is not a file: ' + rawTarget);
    } catch {
      failures.push(relative + ': missing link target: ' + rawTarget);
    }
  }
}

for (const [route, file] of Object.entries(routeFiles)) {
  try {
    assert.equal(statSync(path.join(root, file)).isFile(), true);
  } catch {
    failures.push('route ' + route + ' missing implementation ' + file);
  }
}

const tasks = readFileSync(path.join(root, 'docs', 'tasks.md'), 'utf8');
for (const route of Object.keys(routeFiles)) {
  if (route !== '/' && tasks.includes(route)) {
    const file = routeFiles[route];
    if (!statSync(path.join(root, file)).isFile()) failures.push('tasks route ' + route + ' points to missing ' + file);
  }
}

if (failures.length > 0) {
  console.error('DOCS CHECK FAIL');
  for (const failure of failures) console.error('- ' + failure);
  process.exit(1);
}

console.log('DOCS CHECK PASS: ' + markdownFiles.length + ' markdown files, ' + Object.keys(routeFiles).length + ' routes');

// Automated linter for @kidthales/pgmmv-types:
// 1. Verifies package.json metadata, exports resolution, and package-lock.json version parity
// 2. Runs `node --check` syntax validation on all tools/*.mjs and tests/*.mjs
// 3. Enforces strict ES5 syntax (ecmaVersion: 5, sourceType: 'script') on test/plugin.fixture.js via acorn
// 4. Guards against tracked agent/scratch files in git

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, posix, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseAst } from 'acorn';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const INVALID_EXPORT_TARGET_RE = /(?:^|\/)node_modules(?:\/|$)|%(?:2e|2f|5c)/i;
const REQUIRED_EXPORT_KEYS = ['.', './pgmmv.d.ts', './lib/*', './package.json'];
const AGENT_LEAK_RE =
  /^(\.agents?\/|\.gemini\/|\.ai\/|\.cursor\/|\.claude\/|scratch\/|docs\/learnings\/|AGENTS\.md$|GEMINI\.md$|CLAUDE\.md$)/;

function isWithinRoot(resolvedRoot, candidate) {
  const rel = relative(resolvedRoot, candidate);
  return !isAbsolute(rel) && rel.split(/[\\/]/)[0] !== '..';
}

function hasInvalidExportSegments(pattern) {
  const afterPrefix = pattern.slice(2);
  if (afterPrefix.split('/').some((seg) => seg === '')) {
    return true;
  }
  return [pattern, pattern.replace(/\*/g, '')].some(
    (candidate) =>
      candidate.includes('\\') ||
      INVALID_EXPORT_TARGET_RE.test(candidate.slice(2)) ||
      candidate
        .slice(2)
        .split('/')
        .some((seg) => seg === '.' || seg === '..')
  );
}

function isValidSubpathKey(subpath, errors) {
  if (subpath === '.') {
    return true;
  }
  if (!subpath.startsWith('./')) {
    errors.push(`[exports] Subpath key "${subpath}" must equal "." or start with "./".`);
    return false;
  }
  if ((subpath.match(/\*/g) ?? []).length > 1) {
    errors.push(`[exports] Subpath key "${subpath}" must not contain more than one "*" wildcard.`);
    return false;
  }
  if (hasInvalidExportSegments(subpath)) {
    errors.push(`[exports] Subpath key "${subpath}" contains invalid path segment.`);
    return false;
  }
  return true;
}

function auditExportNode(subpath, node, resolvedRoot, realRoot, errors) {
  if (node === null) {
    return;
  }
  if (Array.isArray(node)) {
    if (node.length === 0) {
      errors.push(`[exports] Export "${subpath}" has an empty fallback array.`);
      return;
    }
    for (const item of node) {
      auditExportNode(subpath, item, resolvedRoot, realRoot, errors);
    }
    return;
  }
  if (typeof node === 'object') {
    const entries = Object.entries(node);
    if (entries.length === 0) {
      errors.push(`[exports] Export "${subpath}" has an empty condition map.`);
      return;
    }
    for (const [condition, value] of entries) {
      if (condition.startsWith('.')) {
        errors.push(`[exports] Export "${subpath}" condition key "${condition}" must not start with ".".`);
        continue;
      }
      auditExportNode(subpath, value, resolvedRoot, realRoot, errors);
    }
    return;
  }
  if (typeof node !== 'string') {
    errors.push(`[exports] Export "${subpath}" has invalid target "${String(node)}".`);
    return;
  }
  if (!node.startsWith('./')) {
    errors.push(`[exports] Export "${subpath}" target "${node}" must start with "./".`);
    return;
  }
  const wildcardCount = (node.match(/\*/g) ?? []).length;
  if (wildcardCount > 1) {
    errors.push(`[exports] Export "${subpath}" target "${node}" must not contain more than one "*" wildcard.`);
    return;
  }
  const hasWildcard = wildcardCount === 1;
  const wildcardSamplePath = resolve(resolvedRoot, node.replace(/\*/g, '_'));
  const wildcardEmptyPath = resolve(resolvedRoot, node.replace(/\*/g, ''));
  let checkPath = node;
  if (hasWildcard) {
    const beforeWildcard = node.slice(0, node.indexOf('*'));
    checkPath = beforeWildcard.endsWith('/') ? beforeWildcard.slice(0, -1) : posix.dirname(beforeWildcard);
    if (!checkPath || checkPath === './') {
      checkPath = '.';
    }
  }
  const resolvedCheckPath = resolve(resolvedRoot, checkPath);
  if (
    !isWithinRoot(resolvedRoot, wildcardSamplePath) ||
    !isWithinRoot(resolvedRoot, wildcardEmptyPath) ||
    !isWithinRoot(resolvedRoot, resolvedCheckPath)
  ) {
    errors.push(`[exports] Export "${subpath}" target "${node}" resolves outside package root.`);
    return;
  }
  if (hasInvalidExportSegments(node)) {
    errors.push(`[exports] Export "${subpath}" target "${node}" contains invalid path segment.`);
    return;
  }
  let targetStat;
  let realCheckPath;
  try {
    targetStat = statSync(resolvedCheckPath);
    realCheckPath = realpathSync(resolvedCheckPath);
  } catch (err) {
    if (err?.code === 'ENOENT' || err?.code === 'ENOTDIR') {
      errors.push(`[exports] Export "${subpath}" target "${node}" does not exist on disk.`);
    } else {
      errors.push(`[exports] Export "${subpath}" target "${node}" could not be inspected: ${err.message}`);
    }
    return;
  }
  if (!isWithinRoot(realRoot, realCheckPath)) {
    errors.push(`[exports] Export "${subpath}" target "${node}" resolves outside package root via symlink.`);
    return;
  }
  if (hasWildcard) {
    if (!targetStat.isDirectory()) {
      errors.push(`[exports] Export "${subpath}" wildcard target "${node}" prefix must resolve to a directory.`);
    }
  } else if (!targetStat.isFile()) {
    errors.push(`[exports] Export "${subpath}" target "${node}" must resolve to a file.`);
  }
}

export function auditPackageExports(targetRoot, pkg) {
  const errors = [];
  const resolvedRoot = resolve(targetRoot);
  let realRoot = resolvedRoot;
  try {
    realRoot = realpathSync(resolvedRoot);
  } catch {
    // Fallback to resolvedRoot if targetRoot does not exist; per-target statSync will fail closed.
  }

  if (typeof pkg.main === 'string' && pkg.main.endsWith('.ts')) {
    errors.push(`[package] package.json "main" must not point to raw TypeScript "${pkg.main}".`);
  }
  if (typeof pkg.types === 'string') {
    const resolvedTypes = resolve(resolvedRoot, pkg.types);
    if (!isWithinRoot(resolvedRoot, resolvedTypes) || !existsSync(resolvedTypes)) {
      errors.push(`[types] package.json "types" target "${pkg.types}" does not exist on disk.`);
    }
  }

  const exportsField = pkg?.exports;
  if (!exportsField || typeof exportsField !== 'object' || Array.isArray(exportsField)) {
    errors.push('[exports] package.json must define an "exports" object map.');
    return errors;
  }

  const keys = Object.keys(exportsField);
  const hasSubpathKeys = keys.some((key) => key.startsWith('.'));
  const hasConditionKeys = keys.some((key) => !key.startsWith('.'));
  if (hasSubpathKeys && hasConditionKeys) {
    errors.push('[exports] package.json exports must not mix "."-prefixed subpath keys with condition keys.');
  }
  if (!hasSubpathKeys && hasConditionKeys) {
    auditExportNode('.', exportsField, resolvedRoot, realRoot, errors);
  } else {
    for (const [subpath, target] of Object.entries(exportsField)) {
      if (subpath.startsWith('.') && !isValidSubpathKey(subpath, errors)) {
        continue;
      }
      auditExportNode(subpath, target, resolvedRoot, realRoot, errors);
    }
  }

  for (const requiredKey of REQUIRED_EXPORT_KEYS) {
    if (!(requiredKey in exportsField)) {
      errors.push(`[exports] package.json exports is missing required subpath "${requiredKey}".`);
    }
  }

  return errors;
}

export function auditLockfileVersion(targetRoot, pkg) {
  const errors = [];
  const lockPath = join(targetRoot, 'package-lock.json');
  if (!existsSync(lockPath)) {
    errors.push('[version] Missing package-lock.json.');
    return errors;
  }
  try {
    const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
    if (lock.version !== pkg.version) {
      errors.push(`[version] package-lock.json version "${lock.version}" does not match package.json "${pkg.version}".`);
    }
    if (lock.packages?.[''] && lock.packages[''].version !== pkg.version) {
      errors.push(
        `[version] package-lock.json packages[""].version "${lock.packages[''].version}" does not match package.json "${pkg.version}".`
      );
    }
  } catch (err) {
    errors.push(`[version] Failed to parse package-lock.json: ${err.message}`);
  }
  return errors;
}

export function auditMjsSyntax(targetRoot) {
  const errors = [];
  for (const dirName of ['tools', 'tests']) {
    const dirPath = join(targetRoot, dirName);
    if (!existsSync(dirPath)) {
      if (dirName === 'tools') {
        errors.push('[syntax] Missing tools/ directory.');
      }
      continue;
    }
    for (const file of readdirSync(dirPath).filter((f) => f.endsWith('.mjs'))) {
      const fullPath = join(dirPath, file);
      try {
        execFileSync(process.execPath, ['--check', fullPath], { stdio: 'pipe' });
      } catch (err) {
        errors.push(`[syntax] ${dirName}/${file}: ${err.stderr?.toString() || err.message}`);
      }
    }
  }
  return errors;
}

export function auditEs5Fixture(targetRoot, relPath = join('test', 'plugin.fixture.js')) {
  const errors = [];
  const fixturePath = join(targetRoot, relPath);
  if (!existsSync(fixturePath)) {
    errors.push(`[es5] Missing ES5 fixture file: ${relPath}`);
    return errors;
  }
  try {
    const source = readFileSync(fixturePath, 'utf8');
    parseAst(source, { ecmaVersion: 5, sourceType: 'script', locations: true });
  } catch (err) {
    errors.push(`[es5] ${relPath}: ${err.message}`);
  }
  return errors;
}

export function auditTrackedHygiene(targetRoot) {
  const errors = [];
  try {
    const tracked = execFileSync('git', ['ls-files'], { cwd: targetRoot, encoding: 'utf8' })
      .split(/\r?\n/)
      .filter(Boolean);
    for (const file of tracked) {
      if (AGENT_LEAK_RE.test(file)) {
        errors.push(`[hygiene] Agent or scratch file tracked in git: ${file}`);
      }
    }
  } catch {
    // Ignore if git is unavailable
  }
  return errors;
}

export function runLint(targetRoot = root) {
  const errors = [];

  const pkgPath = join(targetRoot, 'package.json');
  if (!existsSync(pkgPath)) {
    errors.push('[exports] Missing package.json.');
  } else {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
      errors.push(...auditPackageExports(targetRoot, pkg));
      errors.push(...auditLockfileVersion(targetRoot, pkg));
    } catch (err) {
      errors.push(`[exports] Failed to parse package.json: ${err.message}`);
    }
  }

  errors.push(...auditMjsSyntax(targetRoot));
  errors.push(...auditEs5Fixture(targetRoot));
  errors.push(...auditTrackedHygiene(targetRoot));

  return errors;
}

function isDirectCli(metaUrl) {
  if (!process.argv[1]) {
    return false;
  }
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(metaUrl));
  } catch {
    return resolve(process.argv[1]) === fileURLToPath(metaUrl);
  }
}

if (isDirectCli(import.meta.url)) {
  let targetRoot = root;
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--root') {
      const val = argv[++i];
      if (!val || val.startsWith('-')) {
        console.error('✖ Lint failed: --root requires a directory path');
        process.exit(1);
      }
      targetRoot = resolve(val);
    } else if (arg.startsWith('--root=')) {
      const val = arg.slice('--root='.length);
      if (!val) {
        console.error('✖ Lint failed: --root requires a directory path');
        process.exit(1);
      }
      targetRoot = resolve(val);
    } else {
      console.error(`✖ Lint failed: Unknown option "${arg}"`);
      process.exit(1);
    }
  }

  const errors = runLint(targetRoot);
  if (errors.length > 0) {
    console.error(`✖ Lint failed with ${errors.length} error(s):`);
    for (const e of errors) {
      console.error(`  - ${e}`);
    }
    process.exit(1);
  }

  console.log('✔ Lint passed: exports verified, .mjs syntax valid, ES5 fixture AST valid, zero agent/scratch leaks.');
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditEs5Fixture, auditLockfileVersion, auditPackageExports } from '../tools/lint.mjs';
import { rewriteDeclarationSpecifiers } from '../tools/generate.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function withTempRoot(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'pgmmv_types_test_'));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function collectFiles(dirPath) {
  const files = [];
  for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
    const full = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(full));
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
  return files;
}

test('tools/lint.mjs passes on repo root and fails closed on invalid fixture root', () => {
  const passRes = spawnSync(process.execPath, ['tools/lint.mjs'], {
    cwd: repoRoot,
    encoding: 'utf8'
  });
  assert.equal(passRes.status, 0, `Expected tools/lint.mjs to pass, stderr: ${passRes.stderr}`);
  assert.match(passRes.stdout, /✔ Lint passed:/);

  withTempRoot((corruptRoot) => {
    const failRes = spawnSync(process.execPath, ['tools/lint.mjs', '--root', corruptRoot], {
      cwd: repoRoot,
      encoding: 'utf8'
    });
    assert.notEqual(failRes.status, 0, 'Expected tools/lint.mjs to fail on empty root');
    assert.match(failRes.stderr, /✖ Lint failed/);
  });
});

test('auditEs5Fixture enforces ES5 syntax and rejects ES2015+ syntax', () => {
  withTempRoot((dir) => {
    mkdirSync(join(dir, 'test'), { recursive: true });
    writeFileSync(join(dir, 'test', 'plugin.fixture.js'), 'var ok = function () { return 1; };\n', 'utf8');
    assert.deepEqual(auditEs5Fixture(dir), []);

    writeFileSync(join(dir, 'test', 'plugin.fixture.js'), 'const bad = () => 1;\n', 'utf8');
    const errors = auditEs5Fixture(dir);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /^\[es5\]/);
  });
});

test('auditPackageExports and auditLockfileVersion enforce exports and version parity', () => {
  withTempRoot((dir) => {
    mkdirSync(join(dir, 'dist'), { recursive: true });
    mkdirSync(join(dir, 'lib'), { recursive: true });
    writeFileSync(join(dir, 'dist', 'index.d.ts'), '', 'utf8');
    writeFileSync(join(dir, 'pgmmv.d.ts'), '', 'utf8');
    writeFileSync(join(dir, 'package.json'), '{}', 'utf8');
    writeFileSync(join(dir, 'package-lock.json'), JSON.stringify({ version: '0.2.0-alpha.1' }), 'utf8');

    const pkg = {
      version: '0.2.0-alpha.1',
      types: './dist/index.d.ts',
      exports: {
        '.': { types: './dist/index.d.ts' },
        './pgmmv.d.ts': './pgmmv.d.ts',
        './lib/*': './lib/*',
        './package.json': './package.json'
      }
    };

    assert.deepEqual(auditPackageExports(dir, pkg), []);
    assert.deepEqual(auditLockfileVersion(dir, pkg), []);

    const mismatchErrors = auditLockfileVersion(dir, { version: '9.9.9' });
    assert.equal(mismatchErrors.length, 1);
    assert.match(mismatchErrors[0], /does not match/);
  });
});

test('rewriteDeclarationSpecifiers appends .js / /index.js and resolution-mode attributes', () => {
  withTempRoot((distRoot) => {
    mkdirSync(join(distRoot, 'sub'), { recursive: true });
    const entryDts = join(distRoot, 'index.d.ts');
    const leafDts = join(distRoot, 'leaf.d.ts');
    const subIndexDts = join(distRoot, 'sub', 'index.d.ts');
    writeFileSync(entryDts, '', 'utf8');
    writeFileSync(leafDts, '', 'utf8');
    writeFileSync(subIndexDts, '', 'utf8');

    const input = [
      "import type { JsonValue } from 'type-fest';",
      "export * from './leaf';",
      "export * from './sub';",
      ''
    ].join('\n');

    const output = rewriteDeclarationSpecifiers(input, entryDts, distRoot, distRoot, new Set(['type-fest']));
    assert.equal(
      output,
      [
        "import type { JsonValue } from 'type-fest' with { 'resolution-mode': 'import' };",
        "export * from './leaf.js';",
        "export * from './sub/index.js';",
        ''
      ].join('\n')
    );

    assert.throws(
      () => rewriteDeclarationSpecifiers("export * from './missing';\n", entryDts, distRoot, distRoot, new Set()),
      /Unresolvable relative declaration specifier/
    );
  });
});

test('dist/ contains only .d.ts files with 1:1 parity against lib/**/*.ts', () => {
  const libDir = join(repoRoot, 'lib');
  const distDir = join(repoRoot, 'dist');
  assert.ok(existsSync(distDir), 'dist/ directory must exist');

  const libFiles = collectFiles(libDir)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => relative(libDir, f).replace(/\.ts$/, '.d.ts'))
    .sort();
  const distFiles = collectFiles(distDir);

  const nonDts = distFiles.filter((f) => !f.endsWith('.d.ts'));
  assert.deepEqual(nonDts, [], `Expected zero non-.d.ts files in dist/, found: ${nonDts.join(', ')}`);

  const relDist = distFiles.map((f) => relative(distDir, f)).sort();
  assert.deepEqual(relDist, libFiles);
});

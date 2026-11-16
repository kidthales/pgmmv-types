import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditEs5Fixture, auditLockfileVersion, auditPackageExports, auditTrackedHygiene } from '../tools/lint.mjs';
import {
  generateDeclarations,
  isPackagedDistArtifact,
  rewriteDeclarationSpecifiers,
  validateOutDir
} from '../tools/generate.mjs';

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

    for (const invalidTypes of [undefined, '', '   ', 123]) {
      const missingTypesErrors = auditPackageExports(dir, { ...pkg, types: invalidTypes });
      assert.ok(
        missingTypesErrors.some((e) => e.includes('package.json "types" must be a non-empty string')),
        `Expected non-empty string error for types=${String(invalidTypes)}`
      );
    }

    const dirTypesErrors = auditPackageExports(dir, { ...pkg, types: './dist' });
    assert.ok(
      dirTypesErrors.some((e) => e.includes('must resolve to a file')),
      `Expected directory rejection for pkg.types, got: ${dirTypesErrors.join('; ')}`
    );

    const outsideTypesErrors = auditPackageExports(dir, { ...pkg, types: '../outside.d.ts' });
    assert.ok(
      outsideTypesErrors.some((e) => e.includes('resolves outside package root')),
      `Expected traversal rejection for pkg.types, got: ${outsideTypesErrors.join('; ')}`
    );

    const missingTargetErrors = auditPackageExports(dir, { ...pkg, types: './dist/missing.d.ts' });
    assert.ok(
      missingTargetErrors.some((e) => e.includes('does not exist on disk')),
      `Expected missing file error for pkg.types, got: ${missingTargetErrors.join('; ')}`
    );
  });
});

test('auditPackageExports rejects pkg.types symlink escaping package root', () => {
  withTempRoot((outsideDir) => {
    const outsideFile = join(outsideDir, 'secret.d.ts');
    writeFileSync(outsideFile, 'export {};\n', 'utf8');

    withTempRoot((dir) => {
      mkdirSync(join(dir, 'dist'), { recursive: true });
      mkdirSync(join(dir, 'lib'), { recursive: true });
      writeFileSync(join(dir, 'dist', 'index.d.ts'), '', 'utf8');
      writeFileSync(join(dir, 'pgmmv.d.ts'), '', 'utf8');
      writeFileSync(join(dir, 'package.json'), '{}', 'utf8');

      try {
        symlinkSync(outsideFile, join(dir, 'dist', 'escape.d.ts'), 'file');
      } catch (err) {
        if (err?.code === 'EPERM' || err?.code === 'EACCES') {
          return;
        }
        throw err;
      }

      const pkg = {
        version: '0.2.0-alpha.1',
        types: './dist/escape.d.ts',
        exports: {
          '.': { types: './dist/index.d.ts' },
          './pgmmv.d.ts': './pgmmv.d.ts',
          './lib/*': './lib/*',
          './package.json': './package.json'
        }
      };

      const errors = auditPackageExports(dir, pkg);
      assert.ok(
        errors.some((e) => e.includes('resolves outside package root via symlink')),
        `Expected symlink escape error for pkg.types, got: ${errors.join('; ')}`
      );
    });
  });
});

test('auditTrackedHygiene catches tracked .ci-local/ bundles and nested agent markdown files', () => {
  withTempRoot((dir) => {
    execFileSync('git', ['init'], { cwd: dir, stdio: 'pipe' });
    mkdirSync(join(dir, '.ci-local'), { recursive: true });
    mkdirSync(join(dir, 'nested'), { recursive: true });
    writeFileSync(join(dir, '.ci-local', 'audit-pr-79.md'), '# audit\n', 'utf8');
    writeFileSync(join(dir, 'nested', 'AGENTS.md'), '# agent\n', 'utf8');
    writeFileSync(join(dir, 'GEMINI.md'), '# gemini\n', 'utf8');
    writeFileSync(join(dir, 'README.md'), '# ok\n', 'utf8');
    execFileSync('git', ['add', '-f', '.ci-local/audit-pr-79.md', 'nested/AGENTS.md', 'GEMINI.md', 'README.md'], {
      cwd: dir,
      stdio: 'pipe'
    });

    const errors = auditTrackedHygiene(dir);
    assert.equal(errors.length, 3, `Expected 3 leak errors, got: ${errors.join('; ')}`);
    assert.ok(errors.some((e) => e.includes('.ci-local/audit-pr-79.md')));
    assert.ok(errors.some((e) => e.includes('nested/AGENTS.md')));
    assert.ok(errors.some((e) => e.includes('GEMINI.md')));
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

    const subpathAndAsiInput = [
      "import type { JsonValue } from 'type-fest/source/basic';",
      "import type { Scoped } from '@scope/esm/sub/path';",
      "import type { Other } from 'type-fest-extra';",
      "import type { Cjs } from 'cjs-pkg'",
      "export { B } from 'type-fest'",
      "import type { C } from 'cjs-pkg'",
      'interface Foo { type: string }',
      "export * from '@scope/esm'",
      "import type { D } from 'cjs-pkg'",
      'declare const x: number',
      "export * from 'type-fest'",
      "import type { E } from 'cjs-pkg'",
      'type Alias = number',
      "export * from 'type-fest'",
      "import type { F } from 'cjs-pkg'",
      "import { G } from 'type-fest'",
      "import type { H } from 'type-fest'",
      ''
    ].join('\n');

    const subpathAndAsiOutput = rewriteDeclarationSpecifiers(
      subpathAndAsiInput,
      entryDts,
      distRoot,
      distRoot,
      new Set(['type-fest', '@scope/esm'])
    );
    assert.equal(
      subpathAndAsiOutput,
      [
        "import type { JsonValue } from 'type-fest/source/basic' with { 'resolution-mode': 'import' };",
        "import type { Scoped } from '@scope/esm/sub/path' with { 'resolution-mode': 'import' };",
        "import type { Other } from 'type-fest-extra';",
        "import type { Cjs } from 'cjs-pkg'",
        "export { B } from 'type-fest'",
        "import type { C } from 'cjs-pkg'",
        'interface Foo { type: string }',
        "export * from '@scope/esm'",
        "import type { D } from 'cjs-pkg'",
        'declare const x: number',
        "export * from 'type-fest'",
        "import type { E } from 'cjs-pkg'",
        'type Alias = number',
        "export * from 'type-fest'",
        "import type { F } from 'cjs-pkg'",
        "import { G } from 'type-fest'",
        "import type { H } from 'type-fest' with { 'resolution-mode': 'import' }",
        ''
      ].join('\n')
    );
  });
});

test('validateOutDir rejects reserved directories, subtrees, and symlink escapes', () => {
  withTempRoot((outsideDir) => {
    withTempRoot((dir) => {
      mkdirSync(join(dir, 'lib', 'agtk'), { recursive: true });
      mkdirSync(join(dir, 'tools'), { recursive: true });
      mkdirSync(join(dir, 'tests'), { recursive: true });
      mkdirSync(join(dir, 'test'), { recursive: true });
      mkdirSync(join(dir, 'node_modules'), { recursive: true });
      mkdirSync(join(dir, '.git'), { recursive: true });

      assert.equal(validateOutDir(dir, 'dist'), join(dir, 'dist'));

      for (const badOut of ['../outside', '.', 'lib', 'lib/agtk', '.git', '.github', 'tools', 'tests/sub', 'test', 'node_modules/x']) {
        assert.throws(
          () => validateOutDir(dir, badOut),
          /Invalid output directory/,
          `Expected validateOutDir to reject "${badOut}"`
        );
      }

      const dirLinkType = process.platform === 'win32' ? 'junction' : 'dir';
      symlinkSync(outsideDir, join(dir, 'link-parent'), dirLinkType);
      assert.throws(
        () => validateOutDir(dir, 'link-parent/dist'),
        /resolves outside .* via symlink/
      );

      symlinkSync(join(dir, 'lib'), join(dir, 'link-lib'), dirLinkType);
      assert.throws(
        () => validateOutDir(dir, 'link-lib'),
        /resolves inside reserved directory/
      );
    });
  });
});

test('dist/ contains only .d.ts files with byte-for-byte parity against lib/**/*.ts', () => {
  const libDir = join(repoRoot, 'lib');
  const distDir = join(repoRoot, 'dist');
  assert.ok(existsSync(distDir), 'dist/ directory must exist');

  const libFiles = collectFiles(libDir)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => relative(libDir, f).replace(/\.ts$/, '.d.ts'))
    .sort();
  const distFiles = collectFiles(distDir).filter((f) => !isPackagedDistArtifact(relative(distDir, f)));

  const nonDts = distFiles.filter((f) => !f.endsWith('.d.ts'));
  assert.deepEqual(nonDts, [], `Expected zero non-.d.ts files in dist/, found: ${nonDts.join(', ')}`);

  const relDist = distFiles.map((f) => relative(distDir, f)).sort();
  assert.deepEqual(relDist, libFiles);

  const checkResult = generateDeclarations({ rootDir: repoRoot, check: true });
  assert.equal(checkResult.checked, true);
  assert.equal(checkResult.count, libFiles.length);
});

test('generateDeclarations --check detects content drift, missing files, and extra files', () => {
  withTempRoot((dir) => {
    mkdirSync(join(dir, 'lib'), { recursive: true });
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'fixture', version: '1.0.0' }), 'utf8');
    writeFileSync(join(dir, 'lib', 'index.ts'), 'export interface Demo { id: number; }\n', 'utf8');

    const linkType = process.platform === 'win32' ? 'junction' : 'dir';
    symlinkSync(join(repoRoot, 'node_modules'), join(dir, 'node_modules'), linkType);

    const genRes = generateDeclarations({ rootDir: dir });
    assert.equal(genRes.count, 1);
    assert.equal(generateDeclarations({ rootDir: dir, check: true }).checked, true);

    const dtsPath = join(dir, 'dist', 'index.d.ts');
    writeFileSync(dtsPath, 'export interface Demo { id: string; }\n', 'utf8');
    assert.throws(
      () => generateDeclarations({ rootDir: dir, check: true }),
      /out of date \(drifted \(1\): index\.d\.ts\)/
    );

    generateDeclarations({ rootDir: dir });
    writeFileSync(join(dir, 'dist', 'stale.d.ts'), 'export {};\n', 'utf8');
    assert.throws(
      () => generateDeclarations({ rootDir: dir, check: true }),
      /out of date \(extra \(1\): stale\.d\.ts\)/
    );

    rmSync(join(dir, 'dist', 'stale.d.ts'));
    writeFileSync(join(dir, 'dist', 'extra.js'), 'export {};\n', 'utf8');
    assert.throws(
      () => generateDeclarations({ rootDir: dir, check: true }),
      /Unexpected non-\.d\.ts file\(s\) in dist\//
    );

    rmSync(join(dir, 'dist', 'extra.js'));
    mkdirSync(join(dir, 'dist', 'assets'), { recursive: true });
    writeFileSync(join(dir, 'dist', 'SHA256SUMS.txt'), 'deadbeef  LICENSE\n', 'utf8');
    writeFileSync(join(dir, 'dist', 'assets', 'fixture-1.0.0.tgz'), 'tgz\n', 'utf8');
    assert.equal(generateDeclarations({ rootDir: dir, check: true }).checked, true);

    mkdirSync(join(dir, 'dist', 'sub'), { recursive: true });
    writeFileSync(join(dir, 'dist', 'sub', 'SHA256SUMS.txt'), 'deadbeef  LICENSE\n', 'utf8');
    assert.throws(
      () => generateDeclarations({ rootDir: dir, check: true }),
      /Unexpected non-\.d\.ts file\(s\) in dist\//
    );
    rmSync(join(dir, 'dist', 'sub'), { recursive: true, force: true });

    const outsideTarget = join(dir, 'outside.txt');
    writeFileSync(outsideTarget, 'escape\n', 'utf8');
    try {
      symlinkSync(outsideTarget, join(dir, 'dist', 'assets', 'escape.tgz'), 'file');
      assert.throws(
        () => generateDeclarations({ rootDir: dir, check: true }),
        /Unexpected symlink in dist\//
      );
      rmSync(join(dir, 'dist', 'assets', 'escape.tgz'));
    } catch (err) {
      if (err?.code !== 'EPERM' && err?.code !== 'EACCES') {
        throw err;
      }
    }

    generateDeclarations({ rootDir: dir, outDir: 'custom-dist' });
    writeFileSync(join(dir, 'custom-dist', 'SHA256SUMS.txt'), 'deadbeef  LICENSE\n', 'utf8');
    assert.throws(
      () => generateDeclarations({ rootDir: dir, outDir: 'custom-dist', check: true }),
      /Unexpected non-\.d\.ts file\(s\) in custom-dist\//
    );
  });
});

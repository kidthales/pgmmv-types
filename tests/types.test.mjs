import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const tscJs = path.join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');

function runTsc(args) {
  return spawnSync(process.execPath, [tscJs, ...args], {
    cwd: ROOT,
    encoding: 'utf8'
  });
}

function withTempConsumer(prefix, source, fn) {
  const tempDir = fs.mkdtempSync(path.join(ROOT, 'tests', 'fixtures', 'tsc', prefix));
  try {
    const filePath = path.join(tempDir, 'probe.ts');
    fs.writeFileSync(filePath, source, 'utf8');

    const tsconfigPath = path.join(tempDir, 'tsconfig.json');
    fs.writeFileSync(
      tsconfigPath,
      JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2022',
            lib: ['ES2022', 'DOM'],
            module: 'Node16',
            moduleResolution: 'Node16',
            noEmit: true,
            strict: true,
            skipLibCheck: true
          },
          include: ['probe.ts']
        },
        null,
        2
      ),
      'utf8'
    );

    const result = runTsc(['-p', tsconfigPath, '--noEmit']);
    fn(result);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

test('tsc --noEmit passes on root tsconfig.json (lib/ and plain-JS @ts-check fixture)', () => {
  const result = runTsc(['-p', path.join(ROOT, 'tsconfig.json'), '--noEmit']);
  assert.equal(
    result.status,
    0,
    `Root tsc --noEmit failed with code ${result.status}:\n${result.stdout}\n${result.stderr}`
  );
});

test('tsc --noEmit passes consumer fixture under moduleResolution: bundler', () => {
  const result = runTsc(['-p', path.join(ROOT, 'tests/fixtures/tsc/tsconfig.bundler.json'), '--noEmit']);
  assert.equal(
    result.status,
    0,
    `tsc bundler consumer fixture failed with code ${result.status}:\n${result.stdout}\n${result.stderr}`
  );
});

test('tsc --noEmit passes consumer fixture under moduleResolution: node16', () => {
  const result = runTsc(['-p', path.join(ROOT, 'tests/fixtures/tsc/tsconfig.node16.json'), '--noEmit']);
  assert.equal(
    result.status,
    0,
    `tsc node16 consumer fixture failed with code ${result.status}:\n${result.stdout}\n${result.stderr}`
  );
});

test('tsc rejects global window.kt access after Window.kt removal (N7)', () => {
  withTempConsumer(
    '.tmp-window-kt-',
    "import type {} from '@kidthales/pgmmv-types/pgmmv.d.ts';\nconst x = window.kt;\nvoid x;\n",
    (result) => {
      assert.notEqual(result.status, 0, 'window.kt must fail compilation when Window.kt is not declared');
      assert.match(result.stdout, /error TS2339:/, 'Expected TS2339 error for missing Window.kt property');
    }
  );
});

test('tsc requires sourceId on AgtkEmbeddedParameter while keeping it optional on AgtkEmbeddedEditableParameter (N5)', () => {
  withTempConsumer(
    '.tmp-embedded-sourceid-',
    `import type { AgtkEmbeddedParameter } from '@kidthales/pgmmv-types';
const missing: AgtkEmbeddedParameter = {
  id: 1,
  name: 'Embedded',
  type: 'Embedded'
};
void missing;
`,
    (result) => {
      assert.notEqual(result.status, 0, 'AgtkEmbeddedParameter without sourceId must fail compilation');
      assert.match(result.stdout, /error TS2741:/, 'Expected TS2741 error for missing required sourceId');
    }
  );
});

test('tsc rejects unexported dist/ subpath imports under moduleResolution: node16', () => {
  withTempConsumer(
    '.tmp-unexported-subpath-',
    "import type { Agtk } from '@kidthales/pgmmv-types/dist/index.js';\nexport type { Agtk };\n",
    (result) => {
      assert.notEqual(result.status, 0, 'Unexported dist/ subpath must fail compilation');
      assert.match(result.stdout, /error TS2307:/, 'Expected TS2307 error for unexported subpath');
    }
  );
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import {
  auditWorkflows,
  auditZizmorConfig,
  hasUnescapedExpression,
  SEMVER_RELEASE_TAG_REGEX,
} from '../tools/check-workflows.mjs';
import { generateDeclarations } from '../tools/generate.mjs';
import { packageAssets, resolveNpmCommand } from '../tools/package-assets.mjs';
import {
  assertSafeWriteTarget,
  isDirectCli,
  isSameOrSubpath,
  parseCliOutDir,
  resolveOutDir,
  resolveRealPath,
  stripWin32DeviceNamespacePrefix,
} from '../tools/path-jail.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ciScriptPath = join(root, 'scripts', 'ci-local.ps1');
const checkWorkflowsScriptPath = join(root, 'tools', 'check-workflows.mjs');

const SHA_CHECKOUT = '3d3c42e5aac5ba805825da76410c181273ba90b1';
const SHA_SETUP_NODE = '949feb2413d6458794dcd2491c4babbbce0c15c1';
const SHA_GITLEAKS = 'e0c47f4f8be36e29cdc102c57e68cb5cbf0e8d1e';
const SHA_ZIZMOR = '45d7276c9ca790aabd705e31ca99c6185c3e76dd';
const SHA_ATTEST = '1e69f48acb82d1966a394da916b4c1698aa569d6';

function withTempGithubFixture(files, fn) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'pgmmv_wf_fixture_'));
  try {
    for (const [relPath, content] of Object.entries(files)) {
      const fullPath = join(tempRoot, relPath);
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, content, 'utf8');
    }
    return fn(tempRoot);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function buildCompliantCiYml() {
  return `name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main, 'src-*/epic/**']
  workflow_dispatch:
  workflow_call:
    inputs:
      ref:
        description: 'Git ref or tag to check out when invoked as a reusable workflow'
        required: false
        type: string

permissions:
  contents: read

concurrency:
  group: \${{ github.workflow }}-\${{ github.ref }}
  cancel-in-progress: \${{ github.workflow == 'CI' }}

jobs:
  security:
    name: Security & Workflow Audits (Gitleaks & zizmor)
    runs-on: ubuntu-latest
    timeout-minutes: 10
    permissions:
      contents: read
      security-events: write
    steps:
      - name: Checkout repository
        uses: actions/checkout@${SHA_CHECKOUT}
        with:
          ref: \${{ inputs.ref || '' }}
          fetch-depth: 0
          persist-credentials: false
      - name: Run Gitleaks secret scanner
        uses: gitleaks/gitleaks-action@${SHA_GITLEAKS}
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
      - name: Run zizmor GitHub Actions security analysis
        uses: zizmorcore/zizmor-action@${SHA_ZIZMOR}
        env:
          GH_TOKEN: \${{ secrets.GITHUB_TOKEN }}

  verify:
    name: Verify Types & Declarations (Node \${{ matrix.node }})
    runs-on: ubuntu-latest
    timeout-minutes: 15
    permissions:
      contents: read
    strategy:
      fail-fast: false
      matrix:
        node: [22, 24]
    steps:
      - name: Checkout repository
        uses: actions/checkout@${SHA_CHECKOUT}
        with:
          ref: \${{ inputs.ref || '' }}
          fetch-depth: 0
          persist-credentials: false
      - name: Setup Node.js
        uses: actions/setup-node@${SHA_SETUP_NODE}
        with:
          node-version: \${{ matrix.node == 22 && '>=22.2.0 <23' || matrix.node }}
          cache: npm
      - name: Install dependencies
        run: npm ci
      - name: Run single-source-of-truth CI suite
        run: pwsh ./scripts/ci-local.ps1 -CI

  notify:
    name: Discord CI Notification
    if: always() && github.event_name != 'workflow_call' && github.workflow == 'CI'
    needs: [security, verify]
    runs-on: ubuntu-latest
    timeout-minutes: 5
    permissions:
      contents: read
    steps:
      - name: Dispatch consolidated status card to #dev-ci-builds
        run: echo "done"
`;
}

function buildCompliantReleaseYml({
  workflowEnv = '',
  omitPublishNpm = false,
  verifyUses = './.github/workflows/ci.yml',
  verifyRef = '${{ needs.tag-guard.outputs.sha }}',
  publishCheckoutRef = '${{ needs.tag-guard.outputs.sha }}',
  checkoutToken = '',
  setupNodeToken = '',
  jobPermissions = '      contents: read\n      id-token: write\n',
  jobEnvironment = '    environment:\n      name: npm\n      url: https://www.npmjs.com/package/@kidthales/pgmmv-types\n',
  jobEnv = '',
  includeSetupNode = true,
  nodeVersion = "'>=24.5.0 <25'",
  npmCiRun = 'npm ci --ignore-scripts',
  stepEnv = '',
  publishRun = 'if [[ "$PKG_VER" == *-* ]]; then DIST_TAG="next"; else DIST_TAG="latest"; fi\n          npm publish --tag "$DIST_TAG" --provenance --access public',
  gprPublishLine = '          npm publish --tag "$DIST_TAG" --registry=https://npm.pkg.github.com/',
} = {}) {
  const checkoutTokenLine = checkoutToken ? `\n          token: ${checkoutToken}` : '';
  const setupNodeTokenLine = setupNodeToken ? `\n          token: ${setupNodeToken}` : '';
  const setupNodeBlock = includeSetupNode
    ? `      - name: Setup Node.js
        uses: actions/setup-node@${SHA_SETUP_NODE}
        with:
          node-version: ${nodeVersion}
          package-manager-cache: false
          registry-url: 'https://registry.npmjs.org'${setupNodeTokenLine}
`
    : '';
  const npmCiBlock = npmCiRun
    ? `      - name: Install dependencies
        run: ${npmCiRun}
`
    : '';
  const publishNpmBlock = omitPublishNpm
    ? ''
    : `  publish-npm:
    needs: [tag-guard, verify]
    runs-on: ubuntu-latest
    timeout-minutes: 15
    permissions:
${jobPermissions}${jobEnvironment}${jobEnv}    steps:
      - name: Checkout repository
        uses: actions/checkout@${SHA_CHECKOUT}
        with:
          ref: ${publishCheckoutRef}
          persist-credentials: false${checkoutTokenLine}
${setupNodeBlock}${npmCiBlock}      - name: Publish to npm (Idempotent with Provenance)
${stepEnv}        run: |
          ${publishRun}
`;

  const verifyWithBlock = verifyRef
    ? `    with:
      ref: ${verifyRef}
`
    : '';

  return `name: Release

on:
  release:
    types: [published]
  workflow_dispatch:
    inputs:
      tag:
        description: 'Release tag to verify and publish'
        required: false
        type: string

permissions:
  contents: read

concurrency:
  group: release-\${{ github.repository }}
  cancel-in-progress: false

${workflowEnv}jobs:
  tag-guard:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    permissions:
      contents: read
    outputs:
      sha: \${{ steps.verify-tag.outputs.sha }}
    steps:
      - name: Checkout repository
        uses: actions/checkout@${SHA_CHECKOUT}
        with:
          ref: \${{ github.event.release.tag_name && format('refs/tags/{0}', github.event.release.tag_name) || inputs.tag && format('refs/tags/{0}', inputs.tag) || github.ref }}
          persist-credentials: false
      - name: Setup Node.js
        uses: actions/setup-node@${SHA_SETUP_NODE}
        with:
          node-version: 22
          package-manager-cache: false
      - name: Verify release tag matches package.json version
        id: verify-tag
        env:
          RELEASE_TAG: \${{ github.event.release.tag_name || inputs.tag }}
          REF_NAME: \${{ github.ref_name }}
        run: |
          TAG="\${RELEASE_TAG:-\$REF_NAME}"
          if [ -z "$TAG" ]; then exit 1; fi
          SEMVER_TAG_RE='${SEMVER_RELEASE_TAG_REGEX}'
          if [[ ! "$TAG" =~ $SEMVER_TAG_RE ]]; then exit 1; fi
          PKG_VER=$(node -p "require('./package.json').version")
          EXPECTED_TAG="v\${PKG_VER}"
          if [ "$TAG" != "$EXPECTED_TAG" ]; then exit 1; fi
          TAG_COMMIT=$(git rev-parse --verify --quiet "refs/tags/\${TAG}^{commit}" || true)
          HEAD_COMMIT=$(git rev-parse HEAD)
          if [ -z "$TAG_COMMIT" ] || [ "$TAG_COMMIT" != "$HEAD_COMMIT" ]; then exit 1; fi
          echo "sha=\${HEAD_COMMIT}" >> "$GITHUB_OUTPUT"

  verify:
    needs: [tag-guard]
    permissions:
      contents: read
      security-events: write
    uses: ${verifyUses}
${verifyWithBlock}
${publishNpmBlock}  publish-gpr:
    needs: [tag-guard, verify]
    runs-on: ubuntu-latest
    timeout-minutes: 15
    permissions:
      contents: read
      packages: write
    steps:
      - name: Checkout repository
        uses: actions/checkout@${SHA_CHECKOUT}
        with:
          ref: \${{ needs.tag-guard.outputs.sha }}
          persist-credentials: false
      - name: Setup Node.js
        uses: actions/setup-node@${SHA_SETUP_NODE}
        with:
          node-version: 22
          package-manager-cache: false
      - name: Install dependencies
        run: npm ci --ignore-scripts
      - name: Publish to GitHub Packages (Idempotent)
        run: |
          if [[ "$PKG_VER" == *-* ]]; then DIST_TAG="next"; else DIST_TAG="latest"; fi
${gprPublishLine}

  attach-assets:
    needs: [tag-guard, verify]
    runs-on: ubuntu-latest
    timeout-minutes: 15
    permissions:
      contents: write
      attestations: write
      id-token: write
    steps:
      - name: Checkout repository
        uses: actions/checkout@${SHA_CHECKOUT}
        with:
          ref: \${{ needs.tag-guard.outputs.sha }}
          persist-credentials: false
      - name: Setup Node.js
        uses: actions/setup-node@${SHA_SETUP_NODE}
        with:
          node-version: 22
          package-manager-cache: false
      - name: Install dependencies
        run: npm ci --ignore-scripts
      - name: Package release asset bundles
        run: |
          node tools/package-assets.mjs
          if [ -n "$(git status --porcelain)" ]; then
            echo "::error::Working tree is dirty after packaging release assets:"
            git status --porcelain
            exit 1
          fi
      - name: Attest Build Provenance
        uses: actions/attest@${SHA_ATTEST}
        with:
          subject-path: |
            dist/assets/*.tgz
            dist/SHA256SUMS.txt
            LICENSE
          create-storage-record: false
      - name: Upload release assets to GitHub Release
        env:
          RELEASE_TAG: \${{ github.event.release.tag_name || inputs.tag }}
          REF_NAME: \${{ github.ref_name }}
        run: |
          TAG_NAME="\${RELEASE_TAG:-\$REF_NAME}"
          gh release upload "$TAG_NAME" dist/assets/*.tgz dist/SHA256SUMS.txt LICENSE --clobber

  notify:
    needs: [tag-guard, verify, publish-npm, publish-gpr, attach-assets]
    runs-on: ubuntu-latest
    timeout-minutes: 5
    permissions:
      contents: read
    steps:
      - name: Dispatch release status card to #dev-ci-builds
        env:
          RELEASE_TAG: \${{ github.event.release.tag_name || inputs.tag }}
          REF_NAME: \${{ github.ref_name }}
          SHA: \${{ needs.tag-guard.outputs.sha || github.sha }}
        run: |
          TAG_NAME="\${RELEASE_TAG:-\$REF_NAME}"
          echo "$TAG_NAME"
`;
}

function buildMatchingZizmorYml(releaseYaml) {
  const lines = releaseYaml.split(/\r?\n/);
  const publishLineIdx = lines.findIndex((l) => /^\s*npm publish\b.*--registry=https:\/\/npm\.pkg\.github\.com\//.test(l));
  assert.ok(publishLineIdx >= 0, 'Expected publish-gpr npm publish line in release fixture');
  return `rules:
  use-trusted-publishing:
    ignore:
      - release.yml:${publishLineIdx + 1}
  self-repository:
    ignore:
      - release.yml
`;
}

// ---------------------------------------------------------------------------
// scripts/ci-local.ps1 CLI & Gate 0 contract tests
// ---------------------------------------------------------------------------

test('ci-local.ps1 -CI rejects -Quick, -SkipGenerate, -Gate0Only, and -WorkflowsPath fail-closed', () => {
  for (const flag of ['-Quick', '-SkipGenerate', '-Gate0Only']) {
    const res = spawnSync('pwsh', ['-NoProfile', '-File', ciScriptPath, '-CI', flag], {
      encoding: 'utf8',
    });
    assert.notEqual(res.status, 0, `Expected -CI ${flag} to fail closed`);
    const combined = (res.stdout || '') + (res.stderr || '');
    assert.ok(combined.includes(flag), `Expected output to mention rejected flag ${flag}, got: ${combined}`);
  }

  const wfRes = spawnSync('pwsh', ['-NoProfile', '-File', ciScriptPath, '-CI', '-WorkflowsPath', '.github/workflows'], {
    encoding: 'utf8',
  });
  assert.notEqual(wfRes.status, 0, 'Expected -CI -WorkflowsPath to fail closed');
  assert.ok(((wfRes.stdout || '') + (wfRes.stderr || '')).includes('-WorkflowsPath'));

  const noGate0Res = spawnSync(
    'pwsh',
    ['-NoProfile', '-File', ciScriptPath, '-WorkflowsPath', '.github/workflows'],
    {
      encoding: 'utf8',
      env: { ...process.env, GITHUB_ACTIONS: '' },
    },
  );
  assert.notEqual(noGate0Res.status, 0, 'Expected -WorkflowsPath without -Gate0Only to fail closed');
});

test('ci-local.ps1 -Gate0Only passes on compliant workflow fixture and fails on rogue fixture', () => {
  const ciYml = buildCompliantCiYml();
  const releaseYml = buildCompliantReleaseYml();
  const zizmorYml = buildMatchingZizmorYml(releaseYml);

  withTempGithubFixture(
    {
      '.github/workflows/ci.yml': ciYml,
      '.github/workflows/release.yml': releaseYml,
      '.github/zizmor.yml': zizmorYml,
    },
    (tempRoot) => {
      const wfDir = join(tempRoot, '.github', 'workflows');
      const passRes = spawnSync(
        'pwsh',
        ['-NoProfile', '-File', ciScriptPath, '-Gate0Only', '-WorkflowsPath', wfDir],
        {
          cwd: root,
          encoding: 'utf8',
          env: { ...process.env, GITHUB_ACTIONS: '' },
        },
      );
      const passOut = (passRes.stdout || '') + (passRes.stderr || '');
      assert.equal(passRes.status, 0, `Expected -Gate0Only on compliant fixture to pass, output: ${passOut}`);
      assert.ok(passOut.includes('[gate0_workflow_contract: PASS]'), `Expected PASS summary, got: ${passOut}`);
    },
  );

  withTempGithubFixture(
    {
      '.github/workflows/unauthorized.yml': `name: Unauthorized
permissions:
  contents: read
jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    permissions:
      contents: read
    steps:
      - name: Rogue inline script
        run: echo "rogue"
`,
    },
    (tempRoot) => {
      const wfDir = join(tempRoot, '.github', 'workflows');
      const failRes = spawnSync(
        'pwsh',
        ['-NoProfile', '-File', ciScriptPath, '-Gate0Only', '-WorkflowsPath', wfDir],
        {
          cwd: root,
          encoding: 'utf8',
          env: { ...process.env, GITHUB_ACTIONS: '' },
        },
      );
      assert.notEqual(failRes.status, 0, 'Expected unallowlisted inline script to fail Gate 0');
      const failOut = (failRes.stdout || '') + (failRes.stderr || '');
      assert.ok(failOut.includes('[gate0_workflow_contract: FAIL]'), `Expected FAIL summary, got: ${failOut}`);
      assert.ok(failOut.includes('not in the Gate 0 exact allowlist'), `Expected allowlist violation: ${failOut}`);
    },
  );
});

test('tools/check-workflows.mjs CLI fails closed on invalid arguments and non-compliant fixtures', () => {
  const unknownFlag = spawnSync(process.execPath, [checkWorkflowsScriptPath, '--bogus'], { encoding: 'utf8' });
  assert.notEqual(unknownFlag.status, 0);
  assert.match(unknownFlag.stderr, /unknown flag/);

  const missingArg = spawnSync(process.execPath, [checkWorkflowsScriptPath, '--workflows-dir'], { encoding: 'utf8' });
  assert.notEqual(missingArg.status, 0);
  assert.match(missingArg.stderr, /requires a non-empty directory path/);

  const ciYml = buildCompliantCiYml();
  withTempGithubFixture({ '.github/workflows/ci.yml': ciYml }, (tempRoot) => {
    const cliPass = spawnSync(
      process.execPath,
      [checkWorkflowsScriptPath, '--workflows-dir', join(tempRoot, '.github', 'workflows')],
      { encoding: 'utf8' },
    );
    assert.equal(cliPass.status, 0, `Expected CLI pass, stderr: ${cliPass.stderr}`);
    assert.match(cliPass.stdout, /✔ Workflow audit passed:/);
  });
});

// ---------------------------------------------------------------------------
// Unit tests: hasUnescapedExpression
// ---------------------------------------------------------------------------

test('hasUnescapedExpression rejects direct, backslash-escaped, and multiline expressions', () => {
  assert.equal(hasUnescapedExpression('echo ${{ github.sha }}'), true);
  assert.equal(hasUnescapedExpression('echo \\${{ github.sha }}'), true);
  assert.equal(hasUnescapedExpression('echo \\\\${{ github.sha }}'), true);
  assert.equal(hasUnescapedExpression('${{ inputs.ref }}'), true);
  assert.equal(hasUnescapedExpression('echo ok\n${{ github.event_name }}'), true);

  assert.equal(hasUnescapedExpression('echo "$JOB_STATUS"'), false);
  assert.equal(hasUnescapedExpression('pwsh ./scripts/ci-local.ps1 -CI'), false);
  assert.equal(hasUnescapedExpression(''), false);
  assert.equal(hasUnescapedExpression(null), false);
  assert.equal(hasUnescapedExpression(42), false);
});

// ---------------------------------------------------------------------------
// AST Workflow Auditor: Positive & Negative Falsification Tests
// ---------------------------------------------------------------------------

test('auditWorkflows passes on compliant ci.yml + release.yml + zizmor.yml fixture', () => {
  const ciYml = buildCompliantCiYml();
  const releaseYml = buildCompliantReleaseYml();
  const zizmorYml = buildMatchingZizmorYml(releaseYml);

  withTempGithubFixture(
    {
      '.github/workflows/ci.yml': ciYml,
      '.github/workflows/release.yml': releaseYml,
      '.github/zizmor.yml': zizmorYml,
    },
    (tempRoot) => {
      const res = auditWorkflows(tempRoot);
      assert.equal(res.ok, true, `Expected compliant fixture to pass, got: ${res.violations.join('; ')}`);
      assert.equal(res.length, 0);
    },
  );
});

test('auditWorkflows rejects root permissions violations, missing job permissions, and unauthorized writes', () => {
  withTempGithubFixture(
    {
      '.github/workflows/missing_root.yml': `name: MissingRoot
jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    permissions:
      contents: read
    steps:
      - name: Run CI
        run: ./scripts/ci-local.ps1 -CI
`,
    },
    (dir) => {
      const res = auditWorkflows(dir);
      assert.equal(res.ok, false);
      assert.ok(res.violations.some((v) => v.includes('missing top-level permissions block')));
    },
  );

  withTempGithubFixture(
    {
      '.github/workflows/root_write.yml': `name: RootWrite
permissions:
  contents: write
jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    permissions:
      contents: read
    steps:
      - name: Run CI
        run: ./scripts/ci-local.ps1 -CI
`,
    },
    (dir) => {
      const res = auditWorkflows(dir);
      assert.equal(res.ok, false);
      assert.ok(res.violations.some((v) => v.includes("top-level permissions must be strictly '{ contents: read }'")));
    },
  );

  withTempGithubFixture(
    {
      '.github/workflows/missing_job_perms.yml': `name: MissingJobPerms
permissions:
  contents: read
jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: Run CI
        run: ./scripts/ci-local.ps1 -CI
`,
    },
    (dir) => {
      const res = auditWorkflows(dir);
      assert.equal(res.ok, false);
      assert.ok(res.violations.some((v) => v.includes('missing explicit job-level permissions block')));
    },
  );

  withTempGithubFixture(
    {
      '.github/workflows/bad_job_write.yml': `name: BadJobWrite
permissions:
  contents: read
jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    permissions:
      contents: write
    steps:
      - name: Run CI
        run: ./scripts/ci-local.ps1 -CI
`,
    },
    (dir) => {
      const res = auditWorkflows(dir);
      assert.equal(res.ok, false);
      assert.ok(res.violations.some((v) => v.includes("unauthorized write permission for scope 'contents'")));
    },
  );
});

test('auditWorkflows enforces timeout-minutes <= 30, 40-char SHA pins, persist-credentials: false, and script hygiene', () => {
  for (const badTimeout of ['45', '0', '-5', '12.5', '"10"']) {
    withTempGithubFixture(
      {
        '.github/workflows/timeout.yml': `name: Timeout
permissions:
  contents: read
jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: ${badTimeout}
    permissions:
      contents: read
    steps:
      - name: Run CI
        run: ./scripts/ci-local.ps1 -CI
`,
      },
      (dir) => {
        const res = auditWorkflows(dir);
        assert.equal(res.ok, false);
        assert.ok(res.violations.some((v) => v.includes("has invalid 'timeout-minutes'")));
      },
    );
  }

  withTempGithubFixture(
    {
      '.github/workflows/stepless_matrix.yml': `name: SteplessMatrix
permissions:
  contents: read
jobs:
  matrix_only:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node: [22, 24]
    steps: []
`,
    },
    (dir) => {
      const res = auditWorkflows(dir);
      assert.equal(res.ok, false);
      assert.ok(res.violations.some((v) => v.includes("job 'matrix_only' missing 'timeout-minutes'")));
    },
  );

  withTempGithubFixture(
    {
      '.github/workflows/uses.yml': `name: Uses
permissions:
  contents: read
jobs:
  call_dollar:
    uses: $/.github/workflows/ci.yml
  call_ref:
    uses: ./.github/workflows/ci.yml@main
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    permissions:
      contents: read
    steps:
      - name: Unpinned tag
        uses: actions/checkout@v7
      - name: Missing persist
        uses: actions/checkout@${SHA_CHECKOUT}
        with:
          persist-credentials: true
      - name: Relative parent
        uses: ../local-action
      - name: Unpinned docker
        uses: docker://alpine:latest
      - name: Script injection
        uses: actions/github-script@60a0d83039c74a4aee543508d2ffcb1c3799cdea
        with:
          script: |
            const t = "\${{ secrets.GITHUB_TOKEN }}";
      - name: Install dependencies
        run: echo "\${{ github.ref }}" && npm test
`,
    },
    (dir) => {
      const res = auditWorkflows(dir);
      assert.equal(res.ok, false);
      assert.ok(res.violations.some((v) => v.includes("'$' prefix is invalid")));
      assert.ok(res.violations.some((v) => v.includes('must not specify an @ref')));
      assert.ok(res.violations.some((v) => v.includes('must pin to 40-char commit SHA')));
      assert.ok(res.violations.some((v) => v.includes('without persist-credentials: false')));
      assert.ok(res.violations.some((v) => v.includes("must start with './'")));
      assert.ok(res.violations.some((v) => v.includes('must pin to @sha256 digest')));
      assert.ok(res.violations.some((v) => v.includes('expression interpolation in action script input')));
      assert.ok(res.violations.some((v) => v.includes('contains unescaped expression in run script')));
      assert.ok(res.violations.some((v) => v.includes('forbidden direct test/lint/generate/pack command')));
    },
  );
});

test('auditWorkflows enforces ci.yml architectural contracts', () => {
  const baseCi = buildCompliantCiYml();

  // Missing src-*/epic/** branch coverage
  withTempGithubFixture(
    { '.github/workflows/ci.yml': baseCi.replace("branches: [main, 'src-*/epic/**']", 'branches: [main]') },
    (dir) => {
      const res = auditWorkflows(dir);
      assert.equal(res.ok, false);
      assert.ok(res.violations.some((v) => v.includes("'src-*/epic/**'")));
    },
  );

  // Missing concurrency block
  withTempGithubFixture(
    {
      '.github/workflows/ci.yml': baseCi.replace(
        /concurrency:\r?\n\s+group:[^\n]+\r?\n\s+cancel-in-progress:[^\n]+\r?\n/,
        '',
      ),
    },
    (dir) => {
      const res = auditWorkflows(dir);
      assert.equal(res.ok, false);
      assert.ok(res.violations.some((v) => v.includes('missing top-level concurrency isolation block')));
    },
  );

  // Missing workflow_call input ref & checkout ref
  withTempGithubFixture(
    {
      '.github/workflows/ci.yml': baseCi
        .replace(/workflow_call:[\s\S]*?type: string\r?\n/, 'workflow_call:\n')
        .replaceAll("          ref: ${{ inputs.ref || '' }}\n", ''),
    },
    (dir) => {
      const res = auditWorkflows(dir);
      assert.equal(res.ok, false);
      assert.ok(res.violations.some((v) => v.includes("must declare 'on.workflow_call.inputs.ref'")));
      assert.ok(res.violations.some((v) => v.includes("actions/checkout step must set 'with.ref'")));
    },
  );

  // Verify job invoking non-canonical runner
  withTempGithubFixture(
    {
      '.github/workflows/ci.yml': baseCi.replace(
        'run: pwsh ./scripts/ci-local.ps1 -CI',
        'run: npm test',
      ),
    },
    (dir) => {
      const res = auditWorkflows(dir);
      assert.equal(res.ok, false);
      assert.ok(res.violations.some((v) => v.includes("does not invoke './scripts/ci-local.ps1 -CI'")));
    },
  );

  // Null or omitted pull_request trigger must still fail branch coverage check
  withTempGithubFixture(
    {
      '.github/workflows/ci.yml': baseCi.replace("  pull_request:\n    branches: [main, 'src-*/epic/**']\n", '  pull_request: ~\n'),
    },
    (dir) => {
      const res = auditWorkflows(dir);
      assert.equal(res.ok, false);
      assert.ok(res.violations.some((v) => v.includes("'on.pull_request.branches' must include 'main' and 'src-*/epic/**'")));
    },
  );

  withTempGithubFixture(
    {
      '.github/workflows/ci.yml': baseCi.replace("  pull_request:\n    branches: [main, 'src-*/epic/**']\n", ''),
    },
    (dir) => {
      const res = auditWorkflows(dir);
      assert.equal(res.ok, false);
      assert.ok(res.violations.some((v) => v.includes("missing 'on.pull_request' trigger")));
    },
  );

  // Inline # zizmor: ignore comments in non-release workflows must be rejected
  withTempGithubFixture(
    {
      '.github/workflows/ci.yml': `${baseCi}\n# zizmor: ignore[template-injection]\n`,
    },
    (dir) => {
      const res = auditWorkflows(dir);
      assert.equal(res.ok, false);
      assert.ok(res.violations.some((v) => v.includes('ci.yml must not contain inline # zizmor: ignore comments')));
    },
  );

  // Symlink entries inside .github/workflows/ must be flagged as Gate 0 violations
  withTempGithubFixture(
    {
      '.github/workflows/ci.yml': baseCi,
      'rogue.yml': 'name: Rogue\n',
    },
    (dir) => {
      const wfLink = join(dir, '.github', 'workflows', 'extra.yml');
      try {
        symlinkSync(join(dir, 'rogue.yml'), wfLink, 'file');
      } catch (err) {
        if (err?.code === 'EPERM' || err?.code === 'EACCES') {
          return;
        }
        throw err;
      }
      const res = auditWorkflows(dir);
      assert.equal(res.ok, false);
      assert.ok(res.violations.some((v) => v.includes('Forbidden symlink entry') && v.includes('extra.yml')));
    },
  );
});

test('auditWorkflows enforces release.yml tokenless OIDC invariants (positive and negative)', () => {
  // Positive with allowed secrets.GITHUB_TOKEN in checkout
  withTempGithubFixture(
    { '.github/workflows/release.yml': buildCompliantReleaseYml({ checkoutToken: '${{ secrets.GITHUB_TOKEN }}' }) },
    (dir) => {
      const res = auditWorkflows(dir);
      assert.equal(res.ok, true, `Expected GITHUB_TOKEN checkout to pass, got: ${res.violations.join('; ')}`);
    },
  );

  const negativeCases = [
    {
      name: 'missing publish-npm job',
      opts: { omitPublishNpm: true },
      expected: "missing 'publish-npm' job",
    },
    {
      name: 'verify using $ prefix instead of ./',
      opts: { verifyUses: '$.github/workflows/ci.yml' },
      expected: "verify job must delegate to './.github/workflows/ci.yml'",
    },
    {
      name: 'verify.with.ref not pinned to tag-guard SHA',
      opts: { verifyRef: 'refs/tags/${{ inputs.tag }}' },
      expected: 'verify job must pass verified SHA ref',
    },
    {
      name: 'publish-npm checkout not pinned to tag-guard SHA',
      opts: { publishCheckoutRef: 'refs/tags/${{ inputs.tag }}' },
      expected: 'must check out verified SHA ref',
    },
    {
      name: 'missing id-token: write on publish-npm',
      opts: { jobPermissions: '      contents: read\n' },
      expected: 'exact permissions { contents: read, id-token: write }',
    },
    {
      name: 'extra contents: write on publish-npm',
      opts: { jobPermissions: '      contents: write\n      id-token: write\n' },
      expected: 'exact permissions { contents: read, id-token: write }',
    },
    {
      name: 'missing environment npm',
      opts: { jobEnvironment: '' },
      expected: "must declare environment 'npm'",
    },
    {
      name: 'wrong node-version 24 instead of >=24.5.0 <25',
      opts: { nodeVersion: '24' },
      expected: "must set node-version: '>=24.5.0 <25'",
    },
    {
      name: 'missing setup-node',
      opts: { includeSetupNode: false },
      expected: "must include actions/setup-node with node-version: '>=24.5.0 <25'",
    },
    {
      name: 'step-level NODE_AUTH_TOKEN env binding',
      opts: { stepEnv: '        env:\n          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}\n' },
      expected: "must not bind forbidden env 'NODE_AUTH_TOKEN'",
    },
    {
      name: 'job-level NPM_TOKEN env binding',
      opts: { jobEnv: '    env:\n      NPM_TOKEN: ${{ secrets.NPM_TOKEN }}\n' },
      expected: "must not bind forbidden env 'NPM_TOKEN'",
    },
    {
      name: 'workflow-level NPM_CONFIG__AUTHTOKEN env binding',
      opts: { workflowEnv: 'env:\n  NPM_CONFIG__AUTHTOKEN: ${{ secrets.NPM_TOKEN }}\n' },
      expected: "must not bind forbidden env 'NPM_CONFIG__AUTHTOKEN'",
    },
    {
      name: 'run script _authToken CLI flag',
      opts: {
        publishRun:
          'if [[ "$PKG_VER" == *-* ]]; then DIST_TAG="next"; else DIST_TAG="latest"; fi\n          npm publish --_authToken="tok" --tag "$DIST_TAG" --provenance --access public',
      },
      expected: 'must not reference _authToken',
    },
    {
      name: 'ad-hoc npm install in publish-npm',
      opts: {
        publishRun:
          'if [[ "$PKG_VER" == *-* ]]; then DIST_TAG="next"; else DIST_TAG="latest"; fi\n          npm install -g npm@11.5.1\n          npm publish --tag "$DIST_TAG" --provenance --access public',
      },
      expected: "must not run ad-hoc 'npm install'",
    },
    {
      name: 'npm ci without --ignore-scripts in publish-npm',
      opts: { npmCiRun: 'npm ci' },
      expected: "must pass '--ignore-scripts' to 'npm ci'",
    },
    {
      name: 'npx invocation in publish-npm',
      opts: {
        publishRun:
          'if [[ "$PKG_VER" == *-* ]]; then DIST_TAG="next"; else DIST_TAG="latest"; fi\n          npx some-tool\n          npm publish --tag "$DIST_TAG" --provenance --access public',
      },
      expected: "must not run 'npx some-tool'",
    },
    {
      name: 'secrets.NPM_TOKEN in setup-node with.token',
      opts: { setupNodeToken: '${{ secrets.NPM_TOKEN }}' },
      expected: "must not reference secret 'secrets.NPM_TOKEN'",
    },
    {
      name: 'missing --tag "$DIST_TAG" routing in publish-npm',
      opts: { publishRun: 'npm publish --provenance --access public' },
      expected: "route SemVer pre-releases (*-*) to '--tag next'",
    },
  ];

  for (const tc of negativeCases) {
    withTempGithubFixture(
      { '.github/workflows/release.yml': buildCompliantReleaseYml(tc.opts) },
      (dir) => {
        const res = auditWorkflows(dir);
        assert.equal(res.ok, false, `Expected negative case "${tc.name}" to fail`);
        assert.ok(
          res.violations.some((v) => v.includes(tc.expected)),
          `Expected "${tc.name}" violation to include "${tc.expected}", got: ${res.violations.join('; ')}`,
        );
      },
    );
  }
});

test('auditZizmorConfig enforces exact release.yml line-pin and self-repository parity', () => {
  const releaseYml = buildCompliantReleaseYml();
  const zizmorYml = buildMatchingZizmorYml(releaseYml);

  assert.deepEqual(auditZizmorConfig(zizmorYml, releaseYml), []);

  // Line drift detection
  const drifted = auditZizmorConfig(zizmorYml, `\n${releaseYml}`);
  assert.ok(drifted.some((v) => v.includes('zizmor line pin drifted')));

  // Inline ignore rejection
  const inlineIgnore = auditZizmorConfig(zizmorYml, `${releaseYml}\n# zizmor: ignore[use-trusted-publishing]\n`);
  assert.ok(inlineIgnore.some((v) => v.includes('must not contain inline # zizmor: ignore comments')));

  // Multi-line ignore rejection
  const multiIgnore = auditZizmorConfig(
    'rules:\n  use-trusted-publishing:\n    ignore:\n      - release.yml:1\n      - release.yml:2\n  self-repository:\n    ignore:\n      - release.yml\n',
    releaseYml,
  );
  assert.ok(multiIgnore.some((v) => v.includes('must pin strictly 1 line in release.yml')));

  // self-repository mismatch rejection
  const badSelfRepo = auditZizmorConfig(
    zizmorYml.replace(/self-repository:\s*\r?\n\s+ignore:\s*\r?\n\s+- release\.yml/, 'self-repository:\n    ignore:\n      - ci.yml'),
    releaseYml,
  );
  assert.ok(badSelfRepo.some((v) => v.includes("rules.self-repository.ignore must equal ['release.yml']")));

  // Extra top-level key, extra rule suppression, disable: true, and missing rule rejection
  const extraTopKey = auditZizmorConfig(`${zizmorYml}extra: true\n`, releaseYml);
  assert.ok(extraTopKey.some((v) => v.includes("top-level keys must strictly equal ['rules']")));

  const extraRule = auditZizmorConfig(`${zizmorYml}  unpinned-uses:\n    disable: true\n`, releaseYml);
  assert.ok(extraRule.some((v) => v.includes("rules keys must strictly equal ['self-repository', 'use-trusted-publishing']")));

  const disabledRule = auditZizmorConfig(
    zizmorYml.replace('  use-trusted-publishing:\n', '  use-trusted-publishing:\n    disable: true\n'),
    releaseYml,
  );
  assert.ok(disabledRule.some((v) => v.includes("rules.use-trusted-publishing keys must strictly equal ['ignore']")));

  const disabledSelfRepo = auditZizmorConfig(
    zizmorYml.replace('  self-repository:\n', '  self-repository:\n    disable: true\n'),
    releaseYml,
  );
  assert.ok(disabledSelfRepo.some((v) => v.includes("rules.self-repository keys must strictly equal ['ignore']")));

  // Missing .github/zizmor.yml must fail when requireCanonicalWorkflows is true
  withTempGithubFixture(
    {
      '.github/workflows/ci.yml': buildCompliantCiYml(),
      '.github/workflows/release.yml': releaseYml,
    },
    (dir) => {
      const res = auditWorkflows(dir, { requireCanonicalWorkflows: true });
      assert.equal(res.ok, false);
      assert.ok(res.violations.some((v) => v.includes('Missing required .github/zizmor.yml')));
    },
  );

  // Gate 0 integration catches .github/zizmor.yml drift
  withTempGithubFixture(
    {
      '.github/workflows/release.yml': releaseYml,
      '.github/zizmor.yml': 'rules:\n  use-trusted-publishing:\n    ignore:\n      - release.yml:1\n  self-repository:\n    ignore:\n      - release.yml\n',
    },
    (dir) => {
      const res = auditWorkflows(dir);
      assert.equal(res.ok, false);
      assert.ok(res.violations.some((v) => v.includes('zizmor line pin drifted')));
    },
  );
});

// ---------------------------------------------------------------------------
// Unit tests: tools/path-jail.mjs
// ---------------------------------------------------------------------------

test('path-jail: resolveOutDir and assertSafeWriteTarget enforce repository jail and reject escapes', () => {
  assert.throws(() => resolveOutDir(null), /Invalid outDir/);
  assert.throws(() => resolveOutDir({ outDir: '' }), /Invalid outDir/);
  assert.throws(() => resolveOutDir({ outDir: '   ' }), /Invalid outDir/);
  assert.throws(() => resolveOutDir({ outDir: root }), /refusing to write to protected path/);
  assert.throws(() => resolveOutDir({ outDir: join(root, 'lib') }), /refusing to write to protected path/);
  assert.throws(() => resolveOutDir({ outDir: join(root, 'tools') }), /refusing to write to protected path/);
  assert.throws(() => resolveOutDir({ outDir: join(root, 'tests') }), /refusing to write to protected path/);
  assert.throws(() => resolveOutDir({ outDir: join(root, 'test') }), /refusing to write to protected path/);
  assert.throws(() => resolveOutDir({ outDir: join(root, '..foo') }), /refusing to write outside allowed jail boundary/);
  assert.throws(() => resolveOutDir({ outDir: join(root, 'dist..foo') }), /refusing to write outside allowed jail boundary/);
  assert.throws(() => resolveOutDir({ outDir: dirname(root) }), /refusing to write outside allowed jail boundary/);
  assert.throws(() => resolveOutDir({ outDir: tmpdir() }), /refusing to write outside allowed jail boundary/);

  assert.equal(resolveOutDir(), resolveRealPath(join(root, 'dist')));

  const tempTarget = join(tmpdir(), 'pgmmv_types_dist_out');
  assert.equal(resolveOutDir({ outDir: tempTarget, allowedRoot: tmpdir() }), resolveRealPath(tempTarget));

  assert.throws(() => assertSafeWriteTarget(''), /Invalid targetPath/);
  assert.throws(() => assertSafeWriteTarget(tmpdir()), /refusing to write outside allowed jail boundary/);
  const safeFile = join(root, 'dist', 'assets', 'bundle.tgz');
  assert.equal(assertSafeWriteTarget(safeFile), resolveRealPath(safeFile));
});

test('path-jail: symlink escape outside jail root is rejected', () => {
  const outsideDir = mkdtempSync(join(tmpdir(), 'pgmmv_jail_outside_'));
  const jailDir = mkdtempSync(join(tmpdir(), 'pgmmv_jail_inside_'));
  try {
    const outsideFile = join(outsideDir, 'secret.txt');
    writeFileSync(outsideFile, 'secret\n', 'utf8');
    const escapeLink = join(jailDir, 'escape.txt');
    try {
      symlinkSync(outsideFile, escapeLink, 'file');
    } catch (err) {
      if (err?.code === 'EPERM' || err?.code === 'EACCES') {
        return;
      }
      throw err;
    }
    assert.throws(() => assertSafeWriteTarget(escapeLink, jailDir), /refusing to write outside allowed jail boundary/);
  } finally {
    rmSync(outsideDir, { recursive: true, force: true });
    rmSync(jailDir, { recursive: true, force: true });
  }
});

test('path-jail: parseCliOutDir, stripWin32DeviceNamespacePrefix, isSameOrSubpath, and isDirectCli', () => {
  assert.equal(parseCliOutDir([]), undefined);
  assert.equal(parseCliOutDir(['--other', 'val']), undefined);
  assert.equal(parseCliOutDir(['--outDir', 'dist/assets']), 'dist/assets');
  assert.equal(parseCliOutDir(['--outdir=dist/custom']), 'dist/custom');
  assert.throws(() => parseCliOutDir(['--outDir']), /missing or empty directory argument/);
  assert.throws(() => parseCliOutDir(['--outDir=']), /value cannot be empty/);

  assert.equal(stripWin32DeviceNamespacePrefix('\\\\?\\C:\\repo\\dist'), 'C:\\repo\\dist');
  assert.equal(stripWin32DeviceNamespacePrefix('\\\\?\\UNC\\server\\share\\file'), '\\\\server\\share\\file');
  assert.throws(
    () => stripWin32DeviceNamespacePrefix('\\\\?\\Volume{01234567-89ab-cdef-0123-456789abcdef}\\dist'),
    /unsupported Windows device-namespace or volume path/,
  );

  assert.equal(isSameOrSubpath(join(root, 'dist', 'index.d.ts'), root), true);
  assert.equal(isSameOrSubpath(tmpdir(), root), false);

  const checkWorkflowsUrl = pathToFileURL(checkWorkflowsScriptPath).href;
  assert.equal(isDirectCli(checkWorkflowsUrl, ''), false);
  assert.equal(isDirectCli(checkWorkflowsUrl, checkWorkflowsScriptPath), true);
  assert.equal(isDirectCli(checkWorkflowsUrl, join(root, 'tools', 'lint.mjs')), false);
});

// ---------------------------------------------------------------------------
// Unit tests: tools/package-assets.mjs
// ---------------------------------------------------------------------------

test('packageAssets packs .tgz into outDir/assets, writes SHA256SUMS.txt, and cleans stale tarballs', () => {
  const tempOut = mkdtempSync(join(tmpdir(), 'pgmmv_pkg_assets_'));
  try {
    const staleAssetsDir = join(tempOut, 'assets');
    mkdirSync(staleAssetsDir, { recursive: true });
    writeFileSync(join(staleAssetsDir, 'kidthales-pgmmv-types-0.0.1-stale.tgz'), 'stale', 'utf8');

    const res = packageAssets({ rootDir: root, outDir: tempOut, allowedRoot: tmpdir() });
    assert.match(res.tarballName, /^kidthales-pgmmv-types-.*\.tgz$/);
    assert.equal(existsSync(res.tarballPath), true);
    assert.ok(res.tarballBytes > 0);
    assert.equal(existsSync(res.sha256SumsPath), true);

    const tgzEntries = readdirSync(staleAssetsDir).filter((f) => f.endsWith('.tgz'));
    assert.deepEqual(tgzEntries, [res.tarballName], 'Expected stale .tgz archives to be removed');

    const expectedLicenseSha = createHash('sha256').update(readFileSync(join(root, 'LICENSE'))).digest('hex');
    const expectedTgzSha = createHash('sha256').update(readFileSync(res.tarballPath)).digest('hex');
    const sumsRaw = readFileSync(res.sha256SumsPath, 'utf8');
    const lines = sumsRaw.trimEnd().split('\n');
    assert.deepEqual(lines, [`${expectedLicenseSha}  LICENSE`, `${expectedTgzSha}  ${res.tarballName}`]);
  } finally {
    rmSync(tempOut, { recursive: true, force: true });
  }
});

test('packageAssets and tools/package-assets.mjs CLI fail closed on invalid inputs and missing prerequisites', () => {
  assert.throws(() => packageAssets(null), /Invalid options/);
  assert.throws(() => packageAssets({ rootDir: root, outDir: tmpdir() }), /refusing to write outside allowed jail boundary/);

  withTempGithubFixture(
    {
      'package.json': JSON.stringify({ name: 'fixture', version: '1.0.0' }),
    },
    (tempRoot) => {
      assert.throws(() => packageAssets({ rootDir: tempRoot }), /LICENSE not found/);
      writeFileSync(join(tempRoot, 'LICENSE'), 'MIT\n', 'utf8');
      assert.throws(() => packageAssets({ rootDir: tempRoot }), /generated declarations missing/);
    },
  );

  const pkgAssetsCli = join(root, 'tools', 'package-assets.mjs');
  const unknownFlag = spawnSync(process.execPath, [pkgAssetsCli, '--bogus'], { encoding: 'utf8' });
  assert.notEqual(unknownFlag.status, 0);
  assert.match(unknownFlag.stderr, /Unknown option/);

  const missingOutDir = spawnSync(process.execPath, [pkgAssetsCli, '--outDir'], { encoding: 'utf8' });
  assert.notEqual(missingOutDir.status, 0);
  assert.match(missingOutDir.stderr, /missing or empty directory argument/);
});

function listTgzEntries(tgzPath) {
  const tarBuf = gunzipSync(readFileSync(tgzPath));
  const entries = [];
  let offset = 0;
  while (offset + 512 <= tarBuf.length) {
    const header = tarBuf.subarray(offset, offset + 512);
    if (header.every((b) => b === 0)) {
      break;
    }
    const rawName = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '');
    const rawPrefix = header.subarray(345, 500).toString('utf8').replace(/\0.*$/, '');
    const fullName = rawPrefix ? `${rawPrefix}/${rawName}` : rawName;
    const sizeOctal = header.subarray(124, 136).toString('utf8').replace(/\0.*$/, '').trim();
    const size = sizeOctal ? parseInt(sizeOctal, 8) : 0;
    entries.push(fullName);
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return entries;
}

test('packageAssets default dist/ back-to-back runs (N=1, N=2) never self-include assets or SHA256SUMS.txt', () => {
  for (const filesField of [['dist'], ['dist/**/*.d.ts']]) {
    withTempGithubFixture(
      {
        'package.json': JSON.stringify({
          name: '@fixture/pkg',
          version: '1.0.0',
          files: filesField,
        }),
        LICENSE: 'MIT\n',
        'dist/index.d.ts': 'export declare const ok: true;\n',
        'dist/sub/nested.d.ts': 'export type Nested = string;\n',
      },
      (tempRoot) => {
        const first = packageAssets({ rootDir: tempRoot });
        assert.equal(existsSync(first.tarballPath), true);
        assert.equal(existsSync(first.sha256SumsPath), true);

        const second = packageAssets({ rootDir: tempRoot });
        assert.equal(existsSync(second.tarballPath), true);
        assert.equal(existsSync(second.sha256SumsPath), true);

        const entries = listTgzEntries(second.tarballPath);
        assert.ok(entries.includes('package/dist/index.d.ts'), `Missing dist/index.d.ts in ${entries.join(', ')}`);
        assert.ok(
          entries.includes('package/dist/sub/nested.d.ts'),
          `Missing dist/sub/nested.d.ts in ${entries.join(', ')}`,
        );
        assert.equal(
          entries.some((e) => e.includes('dist/assets/') || e.endsWith('.tgz') || e.includes('SHA256SUMS.txt')),
          false,
          `Unexpected self-included asset entries in packed .tgz: ${entries.join(', ')}`,
        );
      },
    );
  }
});

test('generateDeclarations --check passes immediately after packageAssets on default dist/', () => {
  withTempGithubFixture(
    {
      'package.json': JSON.stringify({
        name: '@fixture/pkg-check',
        version: '1.0.0',
        files: ['dist/**/*.d.ts'],
      }),
      LICENSE: 'MIT\n',
      'lib/index.ts': 'export interface DemoCheck { ok: boolean; }\n',
    },
    (tempRoot) => {
      const linkType = process.platform === 'win32' ? 'junction' : 'dir';
      symlinkSync(join(root, 'node_modules'), join(tempRoot, 'node_modules'), linkType);

      const genRes = generateDeclarations({ rootDir: tempRoot });
      assert.equal(genRes.count, 1);

      const packed = packageAssets({ rootDir: tempRoot });
      assert.equal(existsSync(packed.tarballPath), true);
      assert.equal(existsSync(packed.sha256SumsPath), true);

      const checkRes = generateDeclarations({ rootDir: tempRoot, check: true });
      assert.equal(checkRes.checked, true);
      assert.equal(checkRes.count, 1);
    },
  );
});

test('packageAssets enforces dist/ path-jail confinement and resolves relative outDir against targetRoot', () => {
  assert.throws(
    () => packageAssets({ outDir: join(root, '..foo') }),
    /refusing to write outside allowed jail boundary/,
  );

  withTempGithubFixture(
    {
      'package.json': JSON.stringify({ name: '@fixture/jail', version: '1.0.0', files: ['dist/**/*.d.ts'] }),
      LICENSE: 'MIT\n',
      'dist/index.d.ts': 'export {};\n',
    },
    (tempRoot) => {
      assert.throws(
        () => packageAssets({ rootDir: tempRoot, outDir: join(tempRoot, '..foo') }),
        /refusing to write outside allowed jail boundary/,
      );
      assert.throws(
        () => packageAssets({ rootDir: tempRoot, outDir: '..foo' }),
        /refusing to write outside allowed jail boundary/,
      );

      // Relative --outDir dist with --root <fixture> from a different CWD must succeed
      const pkgAssetsCli = join(root, 'tools', 'package-assets.mjs');
      const cliPass = spawnSync(process.execPath, [pkgAssetsCli, '--root', tempRoot, '--outDir', 'dist'], {
        cwd: root,
        encoding: 'utf8',
      });
      assert.equal(cliPass.status, 0, `Expected CLI --root <dir> --outDir dist to pass, stderr: ${cliPass.stderr}`);
      assert.equal(existsSync(join(tempRoot, 'dist', 'SHA256SUMS.txt')), true);

      const cliFail = spawnSync(process.execPath, [pkgAssetsCli, '--root', tempRoot, '--outDir', '..foo'], {
        cwd: root,
        encoding: 'utf8',
      });
      assert.notEqual(cliFail.status, 0);
      assert.match(cliFail.stderr, /refusing to write outside allowed jail boundary/);
    },
  );
});

test('resolveNpmCommand rejects non-npm npm_execpath (pnpm/yarn) and accepts npm-cli.js', () => {
  withTempGithubFixture(
    {
      'pnpm.cjs': '// mock pnpm\n',
      'yarn.js': '// mock yarn\n',
      'npm-cli.js': '// mock npm\n',
    },
    (tempRoot) => {
      const prevExecPath = process.env.npm_execpath;
      try {
        for (const bogus of ['pnpm.cjs', 'yarn.js']) {
          const bogusPath = join(tempRoot, bogus);
          process.env.npm_execpath = bogusPath;
          const inv = resolveNpmCommand(['pack']);
          assert.notEqual(inv.args[0], bogusPath, `Expected resolveNpmCommand to ignore ${bogus}`);
        }

        const validNpmCli = join(tempRoot, 'npm-cli.js');
        process.env.npm_execpath = validNpmCli;
        const validInv = resolveNpmCommand(['pack']);
        assert.equal(validInv.command, process.execPath);
        assert.deepEqual(validInv.args, [validNpmCli, 'pack']);
      } finally {
        if (prevExecPath === undefined) {
          delete process.env.npm_execpath;
        } else {
          process.env.npm_execpath = prevExecPath;
        }
      }
    },
  );
});

test('auditWorkflows enforces Gate 0 AST invariants (permissions types, attest subjects/order, required jobs/files, privileged npm install)', () => {
  const baseCi = buildCompliantCiYml();
  const baseRelease = buildCompliantReleaseYml();
  const baseZizmor = buildMatchingZizmorYml(baseRelease);

  // 1. Non-object permissions (arrays, booleans, arbitrary strings) on root and job
  for (const badPerm of ['[]', 'true', '123']) {
    withTempGithubFixture(
      {
        '.github/workflows/ci.yml': baseCi.replace('permissions:\n  contents: read', `permissions: ${badPerm}`),
      },
      (dir) => {
        const res = auditWorkflows(dir);
        assert.equal(res.ok, false);
        assert.ok(res.violations.some((v) => v.includes('top-level permissions must be an object')));
      },
    );
  }

  for (const badJobPerm of ['[]', 'true', 'read-all', 'bogus']) {
    withTempGithubFixture(
      {
        '.github/workflows/ci.yml': baseCi.replace(
          '    permissions:\n      contents: read\n    strategy:',
          `    permissions: ${badJobPerm}\n    strategy:`,
        ),
      },
      (dir) => {
        const res = auditWorkflows(dir);
        assert.equal(res.ok, false);
        assert.ok(res.violations.some((v) => v.includes('permissions must be an explicit scope object')));
      },
    );
  }

  // 2. release.yml verify, publish-gpr, and attach-assets exact permission map checks
  withTempGithubFixture(
    {
      '.github/workflows/release.yml': baseRelease.replace(
        '  verify:\n    needs: [tag-guard]\n    permissions:\n      contents: read\n      security-events: write\n',
        '  verify:\n    needs: [tag-guard]\n',
      ),
    },
    (dir) => {
      const res = auditWorkflows(dir);
      assert.equal(res.ok, false);
      assert.ok(res.violations.some((v) => v.includes('verify job must declare exact permissions')));
    },
  );

  for (const badGprPerms of [
    '      contents: read\n',
    '      contents: read\n      packages: write\n      issues: read\n',
  ]) {
    const mutated = baseRelease.replace(
      '  publish-gpr:\n    needs: [tag-guard, verify]\n    runs-on: ubuntu-latest\n    timeout-minutes: 15\n    permissions:\n      contents: read\n      packages: write\n',
      `  publish-gpr:\n    needs: [tag-guard, verify]\n    runs-on: ubuntu-latest\n    timeout-minutes: 15\n    permissions:\n${badGprPerms}`,
    );
    assert.notEqual(mutated, baseRelease, 'Expected publish-gpr permissions fixture mutation to apply');
    withTempGithubFixture({ '.github/workflows/release.yml': mutated }, (dir) => {
      const res = auditWorkflows(dir);
      assert.equal(res.ok, false);
      assert.ok(
        res.violations.some((v) =>
          v.includes('publish-gpr job must declare exact permissions { contents: read, packages: write }'),
        ),
        `Expected publish-gpr exact permissions violation, got: ${res.violations.join('; ')}`,
      );
    });
  }

  {
    const mutated = baseRelease.replace(
      '  attach-assets:\n    needs: [tag-guard, verify]\n    runs-on: ubuntu-latest\n    timeout-minutes: 15\n    permissions:\n      contents: write\n      attestations: write\n      id-token: write\n',
      '  attach-assets:\n    needs: [tag-guard, verify]\n    runs-on: ubuntu-latest\n    timeout-minutes: 15\n    permissions:\n      contents: write\n      attestations: write\n      id-token: write\n      issues: read\n',
    );
    assert.notEqual(mutated, baseRelease, 'Expected attach-assets permissions fixture mutation to apply');
    withTempGithubFixture({ '.github/workflows/release.yml': mutated }, (dir) => {
      const res = auditWorkflows(dir);
      assert.equal(res.ok, false);
      assert.ok(
        res.violations.some((v) =>
          v.includes(
            'attach-assets job must declare exact permissions { contents: write, attestations: write, id-token: write }',
          ),
        ),
        `Expected attach-assets exact permissions violation, got: ${res.violations.join('; ')}`,
      );
    });
  }

  // 3. Missing publish-gpr or attach-assets in release.yml
  withTempGithubFixture(
    {
      '.github/workflows/release.yml': baseRelease.replace(/  publish-gpr:[\s\S]*?(?=  attach-assets:)/, ''),
    },
    (dir) => {
      const res = auditWorkflows(dir);
      assert.equal(res.ok, false);
      assert.ok(res.violations.some((v) => v.includes("missing 'publish-gpr' job")));
    },
  );

  withTempGithubFixture(
    {
      '.github/workflows/release.yml': baseRelease.replace(/  attach-assets:[\s\S]*?(?=  notify:)/, ''),
    },
    (dir) => {
      const res = auditWorkflows(dir);
      assert.equal(res.ok, false);
      assert.ok(res.violations.some((v) => v.includes("missing 'attach-assets' job")));
    },
  );

  // 4. REQUIRED_RELEASE_ATTEST_SUBJECTS mismatch & attach-assets step ordering
  withTempGithubFixture(
    {
      '.github/workflows/release.yml': baseRelease.replace(
        '          subject-path: |\n            dist/assets/*.tgz\n            dist/SHA256SUMS.txt\n            LICENSE',
        '          subject-path: README.md',
      ),
    },
    (dir) => {
      const res = auditWorkflows(dir);
      assert.equal(res.ok, false);
      assert.ok(res.violations.some((v) => v.includes('missing required subject-path entries')));
    },
  );

  withTempGithubFixture(
    {
      '.github/workflows/release.yml': baseRelease.replace(
        /      - name: Package release asset bundles[\s\S]*?      - name: Attest Build Provenance\n        uses: actions\/attest@[^\n]+\n        with:\n          subject-path: \|\n            dist\/assets\/\*\.tgz\n            dist\/SHA256SUMS\.txt\n            LICENSE\n          create-storage-record: false\n/,
        `      - name: Attest Build Provenance
        uses: actions/attest@${SHA_ATTEST}
        with:
          subject-path: |
            dist/assets/*.tgz
            dist/SHA256SUMS.txt
            LICENSE
          create-storage-record: false
      - name: Package release asset bundles
        run: node tools/package-assets.mjs
`,
      ),
    },
    (dir) => {
      const res = auditWorkflows(dir);
      assert.equal(res.ok, false);
      assert.ok(res.violations.some((v) => v.includes('attach-assets steps must execute in order')));
    },
  );

  // 5. Canonical workflow set enforcement (require ci.yml + release.yml, forbid publish.yml)
  withTempGithubFixture({ '.github/workflows/ci.yml': baseCi }, (dir) => {
    const res = auditWorkflows(dir, { requireCanonicalWorkflows: true });
    assert.equal(res.ok, false);
    assert.ok(res.violations.some((v) => v.includes("Missing required canonical workflow 'release.yml'")));
  });

  withTempGithubFixture(
    {
      '.github/workflows/ci.yml': baseCi,
      '.github/workflows/release.yml': baseRelease,
      '.github/workflows/publish.yml': baseRelease,
      '.github/zizmor.yml': baseZizmor,
    },
    (dir) => {
      const res = auditWorkflows(dir, { requireCanonicalWorkflows: true });
      assert.equal(res.ok, false);
      assert.ok(res.violations.some((v) => v.includes("Forbidden legacy workflow 'publish.yml'")));
    },
  );

  // 6. Privileged npm install / npm i / npm add without --ignore-scripts in publish-gpr / attach-assets
  for (const installCmd of ['npm install', 'npm i', 'npm add some-pkg']) {
    withTempGithubFixture(
      {
        '.github/workflows/release.yml': baseRelease.replace(
          '      - name: Install dependencies\n        run: npm ci --ignore-scripts\n      - name: Publish to GitHub Packages',
          `      - name: Install dependencies\n        run: ${installCmd}\n      - name: Publish to GitHub Packages`,
        ),
      },
      (dir) => {
        const res = auditWorkflows(dir);
        assert.equal(res.ok, false);
        assert.ok(res.violations.some((v) => v.includes("must pass '--ignore-scripts' to 'npm ")));
      },
    );
  }
});

test('ci-local.ps1 leak regexes match nested as well as root agent/scratch paths', () => {
  const ps1 = readFileSync(ciScriptPath, 'utf8');
  const trackedMatch = ps1.match(/\$TrackedLeakPattern\s*=\s*'([^']+)'/);
  const untrackedMatch = ps1.match(/\$UntrackedLeakPattern\s*=\s*'([^']+)'/);
  assert.ok(trackedMatch, 'Expected $TrackedLeakPattern in ci-local.ps1');
  assert.ok(untrackedMatch, 'Expected $UntrackedLeakPattern in ci-local.ps1');

  const trackedRe = new RegExp(trackedMatch[1]);
  const untrackedRe = new RegExp(untrackedMatch[1]);
  for (const nestedLeak of ['AGENTS.md', 'sub/AGENTS.md', 'packages/a/.agents/rules.md', 'sub/docs/learnings/x.md']) {
    assert.equal(trackedRe.test(nestedLeak), true, `Expected $TrackedLeakPattern to match ${nestedLeak}`);
    assert.equal(untrackedRe.test(nestedLeak), true, `Expected $UntrackedLeakPattern to match ${nestedLeak}`);
  }
  assert.equal(trackedRe.test('sub/.ci-local/receipt.json'), true);
  assert.equal(untrackedRe.test('.ci-local/receipt.json'), false);
});

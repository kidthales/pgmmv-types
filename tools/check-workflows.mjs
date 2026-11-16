// YAML 1.2 AST Workflow Drift and Security Auditor for @kidthales/pgmmv-types.
// Powered by `yaml` AST traversal. Enforces root least-privilege permissions, explicit job permissions,
// timeout-minutes bounds, 40-char commit SHA action pins, checkout persist-credentials: false,
// zero unescaped ${{ ... }} expressions in run/with.script blocks, canonical ./scripts/ci-local.ps1 -CI
// delegation, tokenless OIDC publish-npm invariants, and .github/zizmor.yml line-pin parity.

import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { isDirectCli } from './path-jail.mjs';

export const DEFAULT_MAX_TIMEOUT_MINUTES = 30;
export const SEMVER_RELEASE_TAG_REGEX = '^v[0-9]+\\.[0-9]+\\.[0-9]+(-(alpha|beta|rc)\\.[1-9][0-9]*)?$';
export const REQUIRED_RELEASE_ATTEST_SUBJECTS = [
  'dist/assets/*.tgz',
  'dist/SHA256SUMS.txt',
  'LICENSE',
];

const EXPECTED_TAG_GUARD_SHA_EXPR = '${{needs.tag-guard.outputs.sha}}';
const EXPECTED_RELEASE_TAG_EXPR = '${{github.event.release.tag_name||inputs.tag}}';
const EXPECTED_REF_NAME_EXPR = '${{github.ref_name}}';
const EXPECTED_NOTIFY_SHA_EXPR = '${{needs.tag-guard.outputs.sha||github.sha}}';
const EXPECTED_CI_CALL_CHECKOUT_EXPRS = new Set(["${{inputs.ref||''}}", '${{inputs.ref}}']);
const EXPECTED_TAG_GUARD_CHECKOUT_EXPRS = new Set([
  "${{github.event.release.tag_name&&format('refs/tags/{0}',github.event.release.tag_name)||inputs.tag&&format('refs/tags/{0}',inputs.tag)||github.ref}}",
  '${{github.event.release.tag_name||inputs.tag||github.ref}}',
]);

// Exact job-id/step-name allowlist pairs for non-verify steps
export const EXACT_STEP_ALLOWLIST = new Set([
  'notify/Dispatch consolidated status card to #dev-ci-builds',
  'notify/Dispatch consolidated status card to',
  'notify/Dispatch release status card to #dev-ci-builds',
  'notify/Dispatch release status card to',
  'tag-guard/Verify release tag matches project metadata versions',
  'tag-guard/Verify release tag matches package.json version',
  'verify/Install dependencies',
  'publish-npm/Install dependencies',
  'publish-npm/Publish to npm (Idempotent with Provenance)',
  'publish-gpr/Install dependencies',
  'publish-gpr/Publish to GitHub Packages (Idempotent)',
  'attach-assets/Install dependencies',
  'attach-assets/Package release asset bundles',
  'attach-assets/Upload release assets to GitHub Release',
]);

// Canonical single-source CI invocation strings accepted without allowlisting
export const CANONICAL_CI_RUNS = new Set([
  './scripts/ci-local.ps1 -CI',
  'pwsh ./scripts/ci-local.ps1 -CI',
  'pwsh -File ./scripts/ci-local.ps1 -CI',
  'pwsh -NoProfile -File ./scripts/ci-local.ps1 -CI',
]);

// Forbidden direct test/lint/generate/pack commands in run steps outside canonical CI
export const FORBIDDEN_COMMAND_PATTERNS = [
  { name: 'npm test', regex: /\bnpm\s+(?:test|t|tst|run\s+test)\b/ },
  { name: 'node --test', regex: /\bnode\s+--test\b/ },
  { name: 'npm run lint', regex: /\bnpm\s+run\s+lint\b/ },
  { name: 'npm run check:types', regex: /\bnpm\s+run\s+check:types\b/ },
  { name: 'npm run generate', regex: /\bnpm\s+run\s+generate\b/ },
  { name: 'npm pack', regex: /\bnpm\s+pack\b/ },
];

export const FORBIDDEN_NPM_OIDC_ENV_KEYS = ['NODE_AUTH_TOKEN', 'NPM_TOKEN', 'NPM_CONFIG__AUTHTOKEN'];

function normalizeExpr(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, '').replace(/"/g, "'") : '';
}

function resolveReal(p) {
  try {
    return typeof realpathSync.native === 'function' ? realpathSync.native(p) : realpathSync(p);
  } catch {
    return resolve(p);
  }
}

function checkNpmCiIgnoreScripts(step, stepLabel, permDesc, violations) {
  if (!step || typeof step !== 'object' || typeof step.run !== 'string') return;
  for (const rawLine of step.run.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/\bnpm\s+(ci|install|i|add)\b/);
    if (match && !/(?:^|\s)--ignore-scripts(?=\s|$)/.test(line)) {
      violations.push(
        `${stepLabel} must pass '--ignore-scripts' to 'npm ${match[1]}' so dependency lifecycle scripts cannot execute with ${permDesc}`,
      );
    }
  }
}

function checkForbiddenEnvBindings(envObj, forbiddenKeys, contextLabel, violations) {
  if (!envObj || typeof envObj !== 'object' || Array.isArray(envObj)) return;
  const upperForbidden = new Set(forbiddenKeys.map((k) => k.toUpperCase()));
  for (const key of Object.keys(envObj)) {
    if (upperForbidden.has(key.toUpperCase()) || /^NPM_CONFIG_.*_AUTHTOKEN$/i.test(key)) {
      violations.push(`${contextLabel} must not bind forbidden env '${key}' (tokenless OIDC required)`);
    }
  }
}

function collectDisallowedSecretsRefs(value, pathLabel, out = []) {
  if (typeof value === 'string') {
    for (const match of value.matchAll(/\bsecrets\s*\.\s*([A-Za-z0-9_]+)\b/gi)) {
      if (match[1].toUpperCase() !== 'GITHUB_TOKEN') {
        out.push({ secretName: match[1], location: pathLabel });
      }
    }
    for (const match of value.matchAll(/\bsecrets\s*\[\s*(['"])([^'"]+)\1\s*\]/gi)) {
      if (match[2].toUpperCase() !== 'GITHUB_TOKEN') {
        out.push({ secretName: match[2], location: pathLabel });
      }
    }
    return out;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      collectDisallowedSecretsRefs(value[i], `${pathLabel}[${i}]`, out);
    }
    return out;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      collectDisallowedSecretsRefs(v, `${pathLabel}.${k}`, out);
    }
  }
  return out;
}

function auditPublishNpmOidcContract(wfName, doc, pubNpm, violations) {
  const perms = pubNpm.permissions;
  const permKeys = perms && typeof perms === 'object' && !Array.isArray(perms) ? Object.keys(perms) : [];
  if (
    !perms ||
    typeof perms !== 'object' ||
    Array.isArray(perms) ||
    permKeys.length !== 2 ||
    perms.contents !== 'read' ||
    perms['id-token'] !== 'write'
  ) {
    violations.push(
      `${wfName}: publish-npm job must declare exact permissions { contents: read, id-token: write } for OIDC Trusted Publishing`,
    );
  }

  const envName = typeof pubNpm.environment === 'string' ? pubNpm.environment : pubNpm.environment?.name;
  if (envName !== 'npm') {
    violations.push(
      `${wfName}: publish-npm job must declare environment 'npm' for OIDC Trusted Publishing (got '${envName ?? ''}')`,
    );
  }

  const requiredNodeRange = '>=24.5.0 <25';
  const steps = Array.isArray(pubNpm.steps) ? pubNpm.steps : [];
  const setupNodeSteps = steps.filter(
    (s) => s && typeof s === 'object' && typeof s.uses === 'string' && s.uses.trim().startsWith('actions/setup-node@'),
  );
  if (setupNodeSteps.length === 0) {
    violations.push(
      `${wfName}: publish-npm job must include actions/setup-node with node-version: '${requiredNodeRange}'`,
    );
  } else {
    for (const snStep of setupNodeSteps) {
      const nv = String(snStep.with?.['node-version'] ?? '').trim();
      if (nv !== requiredNodeRange) {
        violations.push(
          `${wfName}: publish-npm job step '${snStep.name || 'setup-node'}' must set node-version: '${requiredNodeRange}' (got '${nv}')`,
        );
      }
    }
  }

  checkForbiddenEnvBindings(doc.env, FORBIDDEN_NPM_OIDC_ENV_KEYS, `${wfName}: workflow`, violations);
  checkForbiddenEnvBindings(pubNpm.env, FORBIDDEN_NPM_OIDC_ENV_KEYS, `${wfName}: publish-npm job`, violations);
  for (const { secretName, location } of [
    ...collectDisallowedSecretsRefs(doc.env, `${wfName}: workflow env`),
    ...collectDisallowedSecretsRefs(pubNpm.env, `${wfName}: publish-npm job env`),
  ]) {
    violations.push(
      `${location} must not reference secret 'secrets.${secretName}' (only tokenless OIDC or secrets.GITHUB_TOKEN is permitted for publish-npm)`,
    );
  }

  for (const step of steps) {
    if (!step || typeof step !== 'object') continue;
    const stepLabel = `${wfName}: publish-npm step '${step.name || 'unnamed'}'`;
    checkForbiddenEnvBindings(step.env, FORBIDDEN_NPM_OIDC_ENV_KEYS, stepLabel, violations);
    for (const { secretName, location } of collectDisallowedSecretsRefs(
      { env: step.env, with: step.with, run: step.run, if: step.if },
      stepLabel,
    )) {
      violations.push(
        `${location} must not reference secret 'secrets.${secretName}' (only tokenless OIDC or secrets.GITHUB_TOKEN is permitted for publish-npm)`,
      );
    }
    if (typeof step.run === 'string') {
      if (/\b(?:NODE_AUTH_TOKEN|NPM_TOKEN)\b/.test(step.run)) {
        violations.push(`${stepLabel} must not reference NODE_AUTH_TOKEN or NPM_TOKEN in run script`);
      }
      if (/\bNPM_CONFIG_(?:[A-Z0-9_]*_)?_AUTHTOKEN\b/i.test(step.run)) {
        violations.push(`${stepLabel} must not reference NPM_CONFIG__AUTHTOKEN in run script`);
      }
      if (/_authToken/i.test(step.run)) {
        violations.push(
          `${stepLabel} must not reference _authToken in run script (CLI flags, npm config, or .npmrc writes forbidden)`,
        );
      }
      if (/\bnpm\s+(?:install|i|add)\b/.test(step.run)) {
        violations.push(
          `${stepLabel} must not run ad-hoc 'npm install' (use 'npm ci --ignore-scripts' and Node >=24.5.0 bundled npm)`,
        );
      }
      for (const rawLine of step.run.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        if (/\b(?:npx|npm\s+(?:exec|rebuild))\b/.test(line)) {
          violations.push(
            `${stepLabel} must not run '${line}' (dependency script execution forbidden in OIDC publish-npm job)`,
          );
        }
      }
    }
  }
}

/**
 * Checks whether a string contains any ${{ ... }} expression.
 * In GitHub Actions, expressions are expanded before invocation and backslash escaping
 * does not prevent evaluation. Any expression in a shell script block is flagged.
 */
export function hasUnescapedExpression(str) {
  if (typeof str !== 'string') return false;
  return /\$\{\{[\s\S]*?\}\}/.test(str);
}

/**
 * Verifies `.github/zizmor.yml` pins `use-trusted-publishing` ignore strictly to
 * `publish-gpr`'s `npm publish` line in `release.yml` and scopes `self-repository`
 * strictly to `['release.yml']` without inline ignores or line drift.
 */
export function auditZizmorConfig(zizmorRaw, releaseRaw, violations = []) {
  let zizmorDoc;
  try {
    zizmorDoc = parse(zizmorRaw);
  } catch (err) {
    violations.push(`.github/zizmor.yml: YAML parse error: ${err.message}`);
    return violations;
  }

  const trustedIgnore = zizmorDoc?.rules?.['use-trusted-publishing']?.ignore;
  if (!Array.isArray(trustedIgnore)) {
    violations.push('.github/zizmor.yml must define rules.use-trusted-publishing.ignore array');
    return violations;
  }
  if (trustedIgnore.length !== 1) {
    violations.push(
      `.github/zizmor.yml rules.use-trusted-publishing.ignore must pin strictly 1 line in release.yml (got ${trustedIgnore.length})`,
    );
    return violations;
  }

  const linePinMatch = String(trustedIgnore[0]).match(/^release\.yml:(\d+)$/);
  if (!linePinMatch) {
    violations.push(`.github/zizmor.yml expected release.yml:<line> entry, got '${trustedIgnore[0]}'`);
    return violations;
  }
  const pinnedLineNum = Number(linePinMatch[1]);

  const selfRepoIgnore = zizmorDoc?.rules?.['self-repository']?.ignore;
  if (
    !Array.isArray(selfRepoIgnore) ||
    selfRepoIgnore.length !== 1 ||
    selfRepoIgnore[0] !== 'release.yml'
  ) {
    violations.push(
      `.github/zizmor.yml rules.self-repository.ignore must equal ['release.yml'] (got ${JSON.stringify(selfRepoIgnore)})`,
    );
  }

  if (releaseRaw.includes('# zizmor: ignore')) {
    violations.push('release.yml must not contain inline # zizmor: ignore comments');
  }

  const releaseLines = releaseRaw.split(/\r?\n/);
  if (pinnedLineNum < 1 || pinnedLineNum > releaseLines.length) {
    violations.push(`.github/zizmor.yml pinned line ${pinnedLineNum} is out of range for release.yml`);
    return violations;
  }

  const publishGprStart = releaseLines.findIndex((l) => /^\s{2}publish-gpr:\s*$/.test(l)) + 1;
  if (publishGprStart <= 0) {
    violations.push('release.yml must declare publish-gpr job for zizmor line-pin verification');
    return violations;
  }

  let publishGprEnd = releaseLines.length;
  for (let idx = publishGprStart; idx < releaseLines.length; idx++) {
    if (/^\s{2}[A-Za-z0-9_-]+:\s*$/.test(releaseLines[idx])) {
      publishGprEnd = idx;
      break;
    }
  }

  const gprPublishOffset = releaseLines
    .slice(publishGprStart - 1, publishGprEnd)
    .findIndex((l) => /^\s*npm publish\b.*--registry=https:\/\/npm\.pkg\.github\.com\//.test(l));
  if (gprPublishOffset < 0) {
    violations.push('release.yml publish-gpr must contain npm publish --registry=https://npm.pkg.github.com/');
    return violations;
  }

  const actualGprPublishLine = publishGprStart + gprPublishOffset;
  if (pinnedLineNum !== actualGprPublishLine) {
    violations.push(
      `zizmor line pin drifted: .github/zizmor.yml pins release.yml:${pinnedLineNum}, but publish-gpr's npm publish is at release.yml:${actualGprPublishLine}`,
    );
  }

  return violations;
}

/**
 * Checks if a write permission scope is authorized for a specific workflow and job.
 */
function isAuthorizedJobWrite(fileName, jobId, scope) {
  const base = basename(fileName);
  if (scope === 'security-events') {
    return jobId === 'security' || jobId === 'verify';
  }
  if (scope === 'id-token') {
    return base === 'release.yml' && (jobId === 'publish-npm' || jobId === 'attach-assets');
  }
  if (scope === 'packages') {
    return base === 'release.yml' && jobId === 'publish-gpr';
  }
  if (scope === 'contents' || scope === 'attestations') {
    return base === 'release.yml' && jobId === 'attach-assets';
  }
  return false;
}

function validateJobPermissions(wfName, jobId, perms, violations) {
  if (typeof perms === 'string') {
    if (perms === 'write-all') {
      violations.push(`${wfName}: job '${jobId}' has unauthorized write-all permissions`);
    } else {
      violations.push(
        `${wfName}: job '${jobId}' permissions must be an explicit scope object (got ${JSON.stringify(perms)})`,
      );
    }
    return;
  }
  if (!perms || typeof perms !== 'object' || Array.isArray(perms)) {
    violations.push(
      `${wfName}: job '${jobId}' permissions must be an explicit scope object (got ${JSON.stringify(perms)})`,
    );
    return;
  }
  for (const [scope, level] of Object.entries(perms)) {
    if (level !== 'read' && level !== 'write' && level !== 'none') {
      violations.push(
        `${wfName}: job '${jobId}' has invalid permission level '${String(level)}' for scope '${scope}'`,
      );
    } else if (level === 'write' && !isAuthorizedJobWrite(wfName, jobId, scope)) {
      violations.push(`${wfName}: job '${jobId}' has unauthorized write permission for scope '${scope}'`);
    }
  }
}

function validateUsesTarget(wfName, contextLabel, rawTarget, violations) {
  const target = String(rawTarget).trim();
  if (target.startsWith('$')) {
    violations.push(
      `${wfName}: ${contextLabel} uses invalid target '${target}' ('$' prefix is invalid; use './' for same-repository references)`,
    );
  } else if (target.startsWith('./')) {
    if (target.includes('..') || target.includes('\\')) {
      violations.push(`${wfName}: ${contextLabel} uses non-canonical local path '${target}'`);
    }
    if (target.includes('@')) {
      violations.push(
        `${wfName}: ${contextLabel} uses invalid local target '${target}' ('./' same-repository references must not specify an @ref)`,
      );
    }
  } else if (target.startsWith('../')) {
    violations.push(
      `${wfName}: ${contextLabel} uses non-canonical relative path '${target}' (must start with './')`,
    );
  } else if (target.startsWith('docker://')) {
    if (!/@sha256:[0-9a-fA-F]{64}$/.test(target)) {
      violations.push(
        `${wfName}: ${contextLabel} uses unpinned docker action '${target}' (must pin to @sha256 digest)`,
      );
    }
  } else {
    const atIdx = target.lastIndexOf('@');
    const sha = atIdx !== -1 ? target.slice(atIdx + 1).trim() : '';
    if (!/^[0-9a-fA-F]{40}$/.test(sha)) {
      violations.push(
        `${wfName}: ${contextLabel} uses unpinned action '${target}' (must pin to 40-char commit SHA)`,
      );
    }
  }
}

/**
 * Audits all workflow YAML files in target directory or project root.
 * Returns an array of violation strings augmented with `.ok` and `.violations` properties.
 */
export function auditWorkflows(targetPath, options = {}) {
  const violations = [];
  const opts = typeof options === 'string' ? { workflowsDir: options } : (options || {});
  const maxTimeout = opts.maxTimeoutMinutes || DEFAULT_MAX_TIMEOUT_MINUTES;

  if (opts.workflowsDir !== undefined && (typeof opts.workflowsDir !== 'string' || opts.workflowsDir.trim() === '')) {
    const err = 'Invalid workflows directory specified: path must be a non-empty string';
    const res = [err];
    res.ok = false;
    res.violations = res;
    return res;
  }

  let workflowsDir = opts.workflowsDir || targetPath;
  const defaultRootWorkflows = join(dirname(fileURLToPath(import.meta.url)), '..', '.github', 'workflows');
  if (!workflowsDir) {
    workflowsDir = defaultRootWorkflows;
  }

  if (existsSync(workflowsDir)) {
    const stat = statSync(workflowsDir);
    if (stat.isDirectory()) {
      const nested = join(workflowsDir, '.github', 'workflows');
      if (existsSync(nested)) {
        workflowsDir = nested;
      }
    }
  }

  if (!existsSync(workflowsDir)) {
    const err = `Workflows directory not found: ${workflowsDir}`;
    const res = [err];
    res.ok = false;
    res.violations = res;
    return res;
  }

  const entries = readdirSync(workflowsDir, { withFileTypes: true });
  const wfFiles = entries
    .filter((e) => e.isFile() && (e.name.endsWith('.yml') || e.name.endsWith('.yaml')))
    .map((e) => join(workflowsDir, e.name));

  if (wfFiles.length === 0) {
    const err = `Gate 0 failed: no workflow files (*.yml, *.yaml) found in ${workflowsDir}`;
    const res = [err];
    res.ok = false;
    res.violations = res;
    return res;
  }

  const isRootWorkflows = resolveReal(workflowsDir).toLowerCase() === resolveReal(defaultRootWorkflows).toLowerCase();
  const wfNames = new Set(wfFiles.map((f) => basename(f)));
  if (isRootWorkflows || opts.requireCanonicalWorkflows) {
    if (!wfNames.has('ci.yml')) {
      violations.push("Missing required canonical workflow 'ci.yml'");
    }
    if (!wfNames.has('release.yml')) {
      violations.push("Missing required canonical workflow 'release.yml'");
    }
    if (wfNames.has('publish.yml') || wfNames.has('publish.yaml')) {
      violations.push("Forbidden legacy workflow 'publish.yml' must remain deleted");
    }
  }

  for (const wfPath of wfFiles) {
    const wfName = basename(wfPath);
    let content = '';
    try {
      content = readFileSync(wfPath, 'utf8');
    } catch (err) {
      violations.push(`${wfName}: cannot read file: ${err.message}`);
      continue;
    }

    let doc;
    try {
      doc = parse(content);
    } catch (err) {
      violations.push(`${wfName}: YAML parse error: ${err.message}`);
      continue;
    }

    if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
      violations.push(`${wfName}: empty or invalid workflow root`);
      continue;
    }

    // 1. Root permissions check: must be strictly { contents: read }
    if (!doc.permissions) {
      violations.push(`${wfName}: missing top-level permissions block (must be permissions: { contents: read })`);
    } else if (typeof doc.permissions === 'string') {
      violations.push(
        `${wfName}: top-level permissions cannot be string '${doc.permissions}' (must be permissions: { contents: read })`,
      );
    } else if (typeof doc.permissions === 'object' && !Array.isArray(doc.permissions)) {
      const keys = Object.keys(doc.permissions);
      if (keys.length !== 1 || doc.permissions.contents !== 'read') {
        violations.push(
          `${wfName}: top-level permissions must be strictly '{ contents: read }' (got ${JSON.stringify(doc.permissions)})`,
        );
      }
    } else {
      violations.push(
        `${wfName}: top-level permissions must be an object '{ contents: read }' (got ${JSON.stringify(doc.permissions)})`,
      );
    }

    const jobs = doc.jobs && typeof doc.jobs === 'object' && !Array.isArray(doc.jobs) ? doc.jobs : {};

    for (const [jobId, job] of Object.entries(jobs)) {
      if (!job || typeof job !== 'object' || Array.isArray(job)) {
        violations.push(`${wfName}: job '${jobId}' is invalid or empty`);
        continue;
      }

      const hasSteps = Array.isArray(job.steps) && job.steps.length > 0;

      // 2. Timeout-minutes enforcement on every job that runs steps
      if (hasSteps || (!job.uses && !job.strategy?.matrix)) {
        const timeout = job['timeout-minutes'];
        if (timeout === undefined || timeout === null) {
          violations.push(
            `${wfName}: job '${jobId}' missing 'timeout-minutes' (must be positive integer <= ${maxTimeout})`,
          );
        } else if (!Number.isInteger(timeout) || timeout < 1 || timeout > maxTimeout) {
          violations.push(
            `${wfName}: job '${jobId}' has invalid 'timeout-minutes' (${timeout}), must be positive integer <= ${maxTimeout}`,
          );
        }
      }

      // 3. Job permissions check (must be explicitly declared on step-executing jobs, zero unauthorized writes)
      if (hasSteps) {
        if (!Object.hasOwn(job, 'permissions') || job.permissions === undefined || job.permissions === null) {
          violations.push(`${wfName}: job '${jobId}' missing explicit job-level permissions block`);
        } else {
          validateJobPermissions(wfName, jobId, job.permissions, violations);
        }
      } else if (Object.hasOwn(job, 'permissions')) {
        validateJobPermissions(wfName, jobId, job.permissions, violations);
      }

      // Job-level reusable workflow call check
      if (job.uses) {
        validateUsesTarget(wfName, `job '${jobId}'`, job.uses, violations);
      }

      const privilegedPerms = [];
      if (job.permissions && typeof job.permissions === 'object' && !Array.isArray(job.permissions)) {
        if (job.permissions['id-token'] === 'write') privilegedPerms.push('id-token: write');
        if (job.permissions.attestations === 'write') privilegedPerms.push('attestations: write');
        if (job.permissions.packages === 'write') privilegedPerms.push('packages: write');
        if (job.permissions.contents === 'write') privilegedPerms.push('contents: write');
      }

      const steps = Array.isArray(job.steps) ? job.steps : [];
      let jobRunsCanonicalCi = false;

      for (const step of steps) {
        if (!step || typeof step !== 'object') continue;
        const stepName = step.name || 'unnamed';

        if (privilegedPerms.length > 0) {
          checkNpmCiIgnoreScripts(
            step,
            `${wfName}: job '${jobId}' step '${stepName}'`,
            privilegedPerms.join(' / '),
            violations,
          );
        }

        // 4. Action uses pinning and canonical path checks
        if (step.uses) {
          const uses = String(step.uses).trim();
          validateUsesTarget(wfName, `step '${stepName}'`, uses, violations);

          // 5. actions/checkout persist-credentials check
          if (uses.startsWith('actions/checkout@') || uses === 'actions/checkout') {
            if (!step.with || step.with['persist-credentials'] !== false) {
              violations.push(
                `${wfName}: step '${stepName}' uses actions/checkout without persist-credentials: false`,
              );
            }
          }
        }

        // 6. Script execution checks
        if (step.run !== undefined) {
          const rawRun = String(step.run).trim();

          if (hasUnescapedExpression(rawRun)) {
            violations.push(
              `${wfName}: job '${jobId}' step '${stepName}' contains unescaped expression in run script`,
            );
          }

          for (const cmd of FORBIDDEN_COMMAND_PATTERNS) {
            if (cmd.regex.test(rawRun)) {
              violations.push(
                `${wfName}: job '${jobId}' step '${stepName}' runs forbidden direct test/lint/generate/pack command in run script outside ci-local.ps1 -CI (${cmd.name})`,
              );
            }
          }

          const isCanonical = CANONICAL_CI_RUNS.has(rawRun);
          const pairKey = `${jobId}/${stepName}`;
          const isAllowlisted = EXACT_STEP_ALLOWLIST.has(pairKey);

          if (isCanonical) {
            jobRunsCanonicalCi = true;
          }

          if (!isCanonical && !isAllowlisted) {
            violations.push(
              `${wfName}: job '${jobId}' step '${stepName}' runs inline script ('${rawRun}') instead of './scripts/ci-local.ps1 -CI' and pair '${pairKey}' is not in the Gate 0 exact allowlist.`,
            );
          }
        }

        // Script block in action inputs (e.g. actions/github-script)
        if (step.with && typeof step.with === 'object' && step.with.script !== undefined) {
          if (hasUnescapedExpression(String(step.with.script))) {
            violations.push(
              `${wfName}: job '${jobId}' step '${stepName}' contains expression interpolation in action script input`,
            );
          }
        }
      }

      // Verify job canonical CI runner contract
      if (jobId === 'test-and-build' || jobId === 'verify') {
        if (steps.length > 0 && !jobRunsCanonicalCi) {
          violations.push(
            `${wfName}: verify job '${jobId}' defines steps but does not invoke './scripts/ci-local.ps1 -CI'`,
          );
        } else if (steps.length === 0 && job.uses !== './.github/workflows/ci.yml') {
          violations.push(
            `${wfName}: verify job '${jobId}' must either invoke './scripts/ci-local.ps1 -CI' or call './.github/workflows/ci.yml' (got uses: '${job.uses || ''}')`,
          );
        }
      }
    }

    // 7. Workflow-specific architectural contracts
    if (wfName === 'ci.yml') {
      if (doc.name !== 'CI') {
        violations.push(`${wfName}: workflow name must be 'CI' to match concurrency expression`);
      }

      if (!doc.on || typeof doc.on !== 'object' || Array.isArray(doc.on) || !Object.hasOwn(doc.on, 'workflow_call')) {
        violations.push(`${wfName}: missing reusable 'workflow_call' trigger`);
      } else {
        const wfCallRef = doc.on.workflow_call?.inputs?.ref;
        if (!wfCallRef || typeof wfCallRef !== 'object' || wfCallRef.type !== 'string' || wfCallRef.required !== false) {
          violations.push(`${wfName}: must declare 'on.workflow_call.inputs.ref' with 'type: string' and 'required: false'`);
        }
      }

      if (doc.on && typeof doc.on === 'object' && !Array.isArray(doc.on) && doc.on.pull_request) {
        const prBranches = doc.on.pull_request.branches;
        if (!Array.isArray(prBranches) || !prBranches.includes('main') || !prBranches.includes('src-*/epic/**')) {
          violations.push(
            `${wfName}: 'on.pull_request.branches' must include 'main' and 'src-*/epic/**' so Epic sub-issue PRs run CI`,
          );
        }
      }

      if (!doc.concurrency) {
        violations.push(`${wfName}: missing top-level concurrency isolation block`);
      } else {
        const groupNorm = normalizeExpr(doc.concurrency.group);
        const cancelNorm = normalizeExpr(
          typeof doc.concurrency['cancel-in-progress'] === 'string'
            ? doc.concurrency['cancel-in-progress']
            : String(doc.concurrency['cancel-in-progress'] ?? ''),
        );
        if (groupNorm !== '${{github.workflow}}-${{github.ref}}' || cancelNorm !== "${{github.workflow=='CI'}}") {
          violations.push(
            `${wfName}: concurrency must isolate callers via '\${{ github.workflow }}-\${{ github.ref }}' and scope cancel-in-progress to "github.workflow == 'CI'"`,
          );
        }
      }

      if (!jobs.security) {
        violations.push(`${wfName}: missing dedicated 'security' job`);
      } else {
        const secPerms =
          jobs.security.permissions && typeof jobs.security.permissions === 'object' ? jobs.security.permissions : {};
        if (secPerms.contents !== 'read' || secPerms['security-events'] !== 'write') {
          violations.push(`${wfName}: security job must declare permissions { contents: read, security-events: write }`);
        }
        const secSteps = Array.isArray(jobs.security.steps) ? jobs.security.steps : [];
        const hasGitleaks = secSteps.some((s) => s && s.uses && s.uses.includes('gitleaks/gitleaks-action'));
        const hasZizmor = secSteps.some((s) => s && s.uses && s.uses.includes('zizmorcore/zizmor-action'));
        if (!hasGitleaks) {
          violations.push(`${wfName}: security job missing gitleaks action`);
        }
        if (!hasZizmor) {
          violations.push(`${wfName}: security job missing zizmor action`);
        }
      }

      for (const [jKey, jVal] of Object.entries(jobs)) {
        if (!jVal || typeof jVal !== 'object') continue;
        for (const s of Array.isArray(jVal.steps) ? jVal.steps : []) {
          if (s && typeof s === 'object' && typeof s.uses === 'string' && s.uses.trim().startsWith('actions/checkout')) {
            const refNorm = normalizeExpr(s.with?.ref);
            if (!EXPECTED_CI_CALL_CHECKOUT_EXPRS.has(refNorm)) {
              violations.push(
                `${wfName}: job '${jKey}' actions/checkout step must set 'with.ref' to "\${{ inputs.ref || '' }}"`,
              );
            }
          }
        }
      }

      if (jobs.verify) {
        const vSteps = Array.isArray(jobs.verify.steps) ? jobs.verify.steps : [];
        if (vSteps.some((s) => s && s.uses && s.uses.includes('gitleaks/gitleaks-action'))) {
          violations.push(`${wfName}: verify matrix job must not run gitleaks (must run once in security job)`);
        }
      } else {
        violations.push(`${wfName}: missing 'verify' job`);
      }

      if (jobs.notify) {
        const ifCond = String(jobs.notify.if || '');
        if (!ifCond.includes("github.event_name != 'workflow_call'") || !ifCond.includes("github.workflow == 'CI'")) {
          violations.push(
            `${wfName}: notify job missing guard against workflow_call events (github.event_name != 'workflow_call' && github.workflow == 'CI')`,
          );
        }
      }
    } else if (wfName === 'release.yml') {
      if (!jobs['tag-guard']) {
        violations.push(`${wfName}: missing 'tag-guard' job`);
      } else {
        const tgJob = jobs['tag-guard'];
        const tgOutputSha = tgJob.outputs && typeof tgJob.outputs === 'object' ? tgJob.outputs.sha : '';
        if (typeof tgOutputSha !== 'string' || !/outputs\.sha/.test(tgOutputSha)) {
          violations.push(`${wfName}: tag-guard job must declare 'outputs.sha' wired to verified commit SHA`);
        }
        const tgSteps = Array.isArray(tgJob.steps) ? tgJob.steps : [];
        const verifyStep = tgSteps.find((s) => s.name && s.name.includes('Verify release tag'));
        if (!verifyStep || !verifyStep.run || !verifyStep.run.includes('exit 1')) {
          violations.push(`${wfName}: tag-guard step must fail closed with 'exit 1' on empty tag or version mismatch`);
        } else {
          if (!verifyStep.run.includes(SEMVER_RELEASE_TAG_REGEX)) {
            violations.push(`${wfName}: tag-guard must enforce SemVer pre-release regex '${SEMVER_RELEASE_TAG_REGEX}'`);
          }
          if (!/refs\/tags\/\$\{?TAG\}?\^\{commit\}/.test(verifyStep.run)) {
            violations.push(`${wfName}: tag-guard must verify refs/tags/\${TAG}^{commit} parity with HEAD`);
          }
        }
      }

      if (!jobs.verify) {
        violations.push(`${wfName}: missing 'verify' job delegation`);
      } else {
        const vPerms = jobs.verify.permissions;
        const vKeys = vPerms && typeof vPerms === 'object' && !Array.isArray(vPerms) ? Object.keys(vPerms) : [];
        if (
          !vPerms ||
          typeof vPerms !== 'object' ||
          Array.isArray(vPerms) ||
          vKeys.length !== 2 ||
          vPerms.contents !== 'read' ||
          vPerms['security-events'] !== 'write'
        ) {
          violations.push(
            `${wfName}: verify job must declare exact permissions { contents: read, security-events: write }`,
          );
        }
        const needs = Array.isArray(jobs.verify.needs) ? jobs.verify.needs : [jobs.verify.needs];
        if (!needs.includes('tag-guard')) {
          violations.push(`${wfName}: verify job must declare needs: [tag-guard]`);
        }
        if (jobs.verify.uses !== './.github/workflows/ci.yml') {
          violations.push(
            `${wfName}: verify job must delegate to './.github/workflows/ci.yml' (got '${jobs.verify.uses || ''}')`,
          );
        }
        if (normalizeExpr(jobs.verify.with?.ref) !== EXPECTED_TAG_GUARD_SHA_EXPR) {
          violations.push(`${wfName}: verify job must pass verified SHA ref '\${{ needs.tag-guard.outputs.sha }}' to ci.yml`);
        }
      }

      for (const [jobId, job] of Object.entries(jobs)) {
        const jSteps = Array.isArray(job.steps) ? job.steps : [];
        for (const step of jSteps) {
          if (step.uses && step.uses.startsWith('actions/setup-node@')) {
            if (!step.with || step.with['package-manager-cache'] !== false) {
              violations.push(
                `${wfName}: job '${jobId}' step '${step.name || 'setup-node'}' must set package-manager-cache: false`,
              );
            }
          }
          if (step.uses && step.uses.startsWith('actions/checkout@')) {
            const refNorm = normalizeExpr(step.with?.ref);
            if (jobId === 'tag-guard') {
              if (!EXPECTED_TAG_GUARD_CHECKOUT_EXPRS.has(refNorm)) {
                violations.push(
                  `${wfName}: job 'tag-guard' step '${step.name || 'checkout'}' must check out release tag or dispatch ref`,
                );
              }
            } else if (refNorm !== EXPECTED_TAG_GUARD_SHA_EXPR) {
              violations.push(
                `${wfName}: job '${jobId}' step '${step.name || 'checkout'}' must check out verified SHA ref '\${{ needs.tag-guard.outputs.sha }}'`,
              );
            }
          }
        }
      }

      for (const pubJob of ['publish-npm', 'publish-gpr', 'attach-assets']) {
        const j = jobs[pubJob];
        if (!j) {
          violations.push(`${wfName}: missing '${pubJob}' job`);
          continue;
        }
        const jNeeds = Array.isArray(j.needs) ? j.needs : [j.needs];
        if (!jNeeds.includes('tag-guard') || !jNeeds.includes('verify')) {
          violations.push(`${wfName}: ${pubJob} job must declare needs: [tag-guard, verify]`);
        }
        if (pubJob === 'publish-npm') {
          auditPublishNpmOidcContract(wfName, doc, j, violations);
        }
        if (pubJob === 'publish-npm' || pubJob === 'publish-gpr') {
          const jSteps = Array.isArray(j.steps) ? j.steps : [];
          const pubScript = jSteps
            .map((s) => (s && typeof s === 'object' && typeof s.run === 'string' ? s.run : ''))
            .join('\n');
          const hasDistTagSwitch =
            /if\s*\[\[\s*"\$PKG_VER"\s*==\s*\*-\*\s*\]\];\s*then(?:(?!\belse\b)[\s\S])*?DIST_TAG="next"(?:(?!\bfi\b)[\s\S])*?\belse\b(?:(?!\bfi\b)[\s\S])*?DIST_TAG="latest"(?:(?!\bfi\b)[\s\S])*?\bfi\b/.test(
              pubScript,
            );
          const hasPublishDistTag = /\bnpm\s+publish\b[^\n]*--tag\s+"\$DIST_TAG"/.test(pubScript);
          if (!hasDistTagSwitch || !hasPublishDistTag) {
            violations.push(
              `${wfName}: ${pubJob} job must route SemVer pre-releases (*-*) to '--tag next' and stable releases to '--tag latest' via DIST_TAG`,
            );
          }
        }
      }

      if (jobs['attach-assets']) {
        const aaPerms =
          jobs['attach-assets'].permissions && typeof jobs['attach-assets'].permissions === 'object'
            ? jobs['attach-assets'].permissions
            : {};
        if (aaPerms.contents !== 'write' || aaPerms.attestations !== 'write' || aaPerms['id-token'] !== 'write') {
          violations.push(
            `${wfName}: attach-assets job must explicitly scope permissions (contents: write, attestations: write, id-token: write)`,
          );
        }
        const aaSteps = Array.isArray(jobs['attach-assets'].steps) ? jobs['attach-assets'].steps : [];
        const pkgIdx = aaSteps.findIndex(
          (s) => s && typeof s === 'object' && typeof s.run === 'string' && /\bnode\s+tools\/package-assets\.mjs\b/.test(s.run),
        );
        const attestIdx = aaSteps.findIndex((s) => s && typeof s === 'object' && s.uses && s.uses.startsWith('actions/attest@'));
        const uploadIdx = aaSteps.findIndex(
          (s) => s && typeof s === 'object' && typeof s.run === 'string' && /\bgh\s+release\s+upload\b/.test(s.run),
        );

        if (pkgIdx < 0) {
          violations.push(`${wfName}: attach-assets job missing 'node tools/package-assets.mjs' packaging step`);
        }
        if (attestIdx < 0) {
          violations.push(`${wfName}: attach-assets job missing actions/attest step`);
        } else {
          const rawSubjectPath = aaSteps[attestIdx].with?.['subject-path'];
          const subjectEntries = Array.isArray(rawSubjectPath)
            ? rawSubjectPath.map((entry) => String(entry).trim()).filter(Boolean)
            : typeof rawSubjectPath === 'string'
              ? rawSubjectPath
                  .split(/\r?\n/)
                  .map((line) => line.trim())
                  .filter(Boolean)
              : [];
          const subjectSet = new Set(subjectEntries);
          const missingSubjects = REQUIRED_RELEASE_ATTEST_SUBJECTS.filter((subj) => !subjectSet.has(subj));
          if (missingSubjects.length > 0) {
            violations.push(
              `${wfName}: attach-assets actions/attest step missing required subject-path entries: ${missingSubjects.join(', ')}`,
            );
          }
        }
        if (uploadIdx < 0) {
          violations.push(`${wfName}: attach-assets job missing 'gh release upload' step`);
        }
        if (pkgIdx >= 0 && attestIdx >= 0 && uploadIdx >= 0 && !(pkgIdx < attestIdx && attestIdx < uploadIdx)) {
          violations.push(
            `${wfName}: attach-assets steps must execute in order: package-assets.mjs -> actions/attest -> gh release upload`,
          );
        }
      }

      if (jobs.notify) {
        const notifySteps = Array.isArray(jobs.notify.steps) ? jobs.notify.steps : [];
        const notifyTagStep = notifySteps.find(
          (s) => s && typeof s === 'object' && typeof s.run === 'string' && s.run.includes('TAG_NAME='),
        );
        if (notifyTagStep) {
          if (
            normalizeExpr(notifyTagStep.env?.RELEASE_TAG) !== EXPECTED_RELEASE_TAG_EXPR ||
            normalizeExpr(notifyTagStep.env?.REF_NAME) !== EXPECTED_REF_NAME_EXPR
          ) {
            violations.push(
              `${wfName}: notify job must pass 'RELEASE_TAG: \${{ github.event.release.tag_name || inputs.tag }}' and 'REF_NAME: \${{ github.ref_name }}'`,
            );
          }
          if (normalizeExpr(notifyTagStep.env?.SHA) !== EXPECTED_NOTIFY_SHA_EXPR) {
            violations.push(
              `${wfName}: notify job must pass 'SHA: \${{ needs.tag-guard.outputs.sha || github.sha }}'`,
            );
          }
        }
      }

      const zizmorPath = join(dirname(workflowsDir), 'zizmor.yml');
      if (existsSync(zizmorPath)) {
        auditZizmorConfig(readFileSync(zizmorPath, 'utf8'), content, violations);
      } else if (isRootWorkflows) {
        violations.push('Missing required .github/zizmor.yml for release.yml use-trusted-publishing line-pin enforcement');
      }
    }
  }

  const result = [...violations];
  result.ok = violations.length === 0;
  result.violations = violations;
  return result;
}

// CLI entrypoint
if (isDirectCli(import.meta.url)) {
  let targetDir = '';
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--workflows-dir') {
      const next = args[i + 1];
      if (!next || next.startsWith('-')) {
        console.error('Gate 0 usage error: --workflows-dir requires a non-empty directory path');
        process.exit(1);
      }
      targetDir = next;
      i++;
    } else if (arg.startsWith('--workflows-dir=')) {
      const val = arg.slice('--workflows-dir='.length).trim();
      if (!val) {
        console.error('Gate 0 usage error: --workflows-dir= requires a non-empty directory path');
        process.exit(1);
      }
      targetDir = val;
    } else if (arg.startsWith('-')) {
      console.error(`Gate 0 usage error: unknown flag '${arg}'`);
      process.exit(1);
    } else {
      targetDir = arg;
    }
  }

  const violations = auditWorkflows(targetDir);
  if (!violations.ok) {
    for (const v of violations) {
      console.error(`Gate 0 violation: ${v}`);
    }
    process.exit(1);
  }

  console.log('✔ Workflow audit passed: All workflows conform to AST drift, OIDC, and security invariants.');
  process.exit(0);
}

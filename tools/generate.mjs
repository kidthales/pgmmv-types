// Deterministic node16-clean declaration generator for @kidthales/pgmmv-types:
// 1. Emits .d.ts declarations from lib/ into a staging directory via tsc --declaration --emitDeclarationOnly
// 2. Rewrites all relative module specifiers to explicit .js / /index.js extensions
// 3. Verifies zero runtime .js emission, 1:1 parity with lib/**/*.ts, and strict tsc --moduleResolution node16 validation
// 4. Atomically replaces dist/ with the verified declaration tree

import { execFileSync } from 'node:child_process';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDirectCli, isSameOrSubpath, PROTECTED_INTERNAL_DIRS, resolveRealPath } from './path-jail.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const STATEMENT_RESET_KEYWORDS = new Set([
  'import',
  'export',
  'declare',
  'interface',
  'type',
  'class',
  'const',
  'let',
  'var',
  'function',
  'enum',
  'namespace',
  'abstract'
]);

function compareCodePoints(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function isWithinRoot(resolvedRoot, candidate) {
  const rel = relative(resolvedRoot, candidate);
  return !isAbsolute(rel) && rel.split(/[\\/]/)[0] !== '..';
}

function collectFiles(dirPath, predicate) {
  const results = [];

  function walk(currentDir) {
    const entries = readdirSync(currentDir, { withFileTypes: true }).sort((a, b) =>
      compareCodePoints(a.name, b.name)
    );
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && predicate(fullPath, entry.name)) {
        results.push(fullPath);
      }
    }
  }

  walk(dirPath);
  return results;
}

function resolveRelativeSpecifier(spec, filePath, distRoot, realDistRoot) {
  const fileDir = dirname(filePath);
  const cleanSpec = spec.length > 2 && spec.endsWith('/') ? spec.slice(0, -1) : spec;

  if (/\.(m|c)?js$/.test(cleanSpec)) {
    const dtsPath = resolve(fileDir, cleanSpec.replace(/\.(m|c)?js$/, '.d.$1ts'));
    if (!isWithinRoot(distRoot, dtsPath) || !existsSync(dtsPath) || !statSync(dtsPath).isFile()) {
      throw new Error(`Unresolvable relative JS specifier "${spec}" in ${relative(distRoot, filePath)}`);
    }
    if (!isWithinRoot(realDistRoot, realpathSync(dtsPath))) {
      throw new Error(`Relative specifier "${spec}" escapes dist root via symlink`);
    }
    return cleanSpec;
  }

  if (/\.(m|c)?ts$/.test(cleanSpec)) {
    const dtsPath = resolve(fileDir, cleanSpec.replace(/\.(m|c)?ts$/, '.d.$1ts'));
    if (!isWithinRoot(distRoot, dtsPath) || !existsSync(dtsPath) || !statSync(dtsPath).isFile()) {
      throw new Error(`Unresolvable relative TS specifier "${spec}" in ${relative(distRoot, filePath)}`);
    }
    if (!isWithinRoot(realDistRoot, realpathSync(dtsPath))) {
      throw new Error(`Relative specifier "${spec}" escapes dist root via symlink`);
    }
    return cleanSpec.replace(/\.(m|c)?ts$/, '.$1js');
  }

  const targetBase = resolve(fileDir, cleanSpec);
  if (!isWithinRoot(distRoot, targetBase)) {
    throw new Error(`Relative specifier "${spec}" escapes dist root in ${relative(distRoot, filePath)}`);
  }

  if (cleanSpec !== '.' && cleanSpec !== '..') {
    const fileTarget = `${targetBase}.d.ts`;
    if (existsSync(fileTarget) && statSync(fileTarget).isFile()) {
      if (!isWithinRoot(realDistRoot, realpathSync(fileTarget))) {
        throw new Error(`Relative specifier "${spec}" escapes dist root via symlink`);
      }
      return `${cleanSpec}.js`;
    }
  }

  const indexTarget = join(targetBase, 'index.d.ts');
  if (existsSync(indexTarget) && statSync(indexTarget).isFile()) {
    if (!isWithinRoot(realDistRoot, realpathSync(indexTarget))) {
      throw new Error(`Relative specifier "${spec}" escapes dist root via symlink`);
    }
    return `${cleanSpec}/index.js`;
  }

  throw new Error(`Unresolvable relative declaration specifier "${spec}" in ${relative(distRoot, filePath)}`);
}

function getPackageName(spec) {
  if (!spec || spec.startsWith('.') || spec.startsWith('/') || spec.startsWith('node:')) {
    return null;
  }
  if (spec.startsWith('@')) {
    const parts = spec.split('/');
    return parts.length >= 2 && parts[1] ? `${parts[0]}/${parts[1]}` : null;
  }
  return spec.split('/')[0] || null;
}

export function rewriteDeclarationSpecifiers(
  source,
  filePath,
  distRoot,
  realDistRoot = realpathSync(distRoot),
  esmPackages = new Set()
) {
  const out = [];
  let i = 0;
  let prev1 = null;
  let prev2 = null;
  let stmtStart = true;
  let isImportTypeStmt = false;
  let braceDepth = 0;

  const pushToken = (type, value) => {
    prev2 = prev1;
    prev1 = { type, value };
  };

  while (i < source.length) {
    const ch = source[i];

    // Whitespace (does not update significant token history)
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      out.push(ch);
      i++;
      continue;
    }

    // Line comment
    if (ch === '/' && source[i + 1] === '/') {
      const start = i;
      i += 2;
      while (i < source.length && source[i] !== '\n') {
        i++;
      }
      out.push(source.slice(start, i));
      continue;
    }

    // Block comment
    if (ch === '/' && source[i + 1] === '*') {
      const start = i;
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) {
        i++;
      }
      if (i < source.length) {
        i += 2;
      }
      out.push(source.slice(start, i));
      continue;
    }

    // String literal
    if (ch === "'" || ch === '"') {
      const quote = ch;
      const start = i;
      i++;
      while (i < source.length) {
        if (source[i] === '\\') {
          i += 2;
          continue;
        }
        if (source[i] === quote) {
          i++;
          break;
        }
        i++;
      }
      const rawLiteral = source.slice(start, i);
      const spec = rawLiteral.slice(1, -1);
      const isFromClause = prev1?.type === 'ident' && prev1.value === 'from';
      const isModuleSpecifier =
        isFromClause ||
        (prev1?.type === 'ident' && prev1.value === 'import') ||
        (prev2?.type === 'ident' && prev2.value === 'import' && prev1?.type === 'punct' && prev1.value === '(');

      const pkgName = getPackageName(spec);
      if (
        isModuleSpecifier &&
        (spec === '.' || spec === '..' || spec.startsWith('./') || spec.startsWith('../'))
      ) {
        const rewritten = resolveRelativeSpecifier(spec, filePath, distRoot, realDistRoot);
        out.push(`${quote}${rewritten}${quote}`);
      } else if (isFromClause && isImportTypeStmt && pkgName && esmPackages.has(pkgName)) {
        // Add resolution-mode attribute for type-only imports of ESM dependencies from CJS .d.ts files
        let lookahead = i;
        while (lookahead < source.length && /[ \t\r\n]/.test(source[lookahead])) {
          lookahead++;
        }
        const hasWithAttr = source.slice(lookahead).startsWith('with');
        out.push(
          hasWithAttr
            ? rawLiteral
            : `${rawLiteral} with { ${quote}resolution-mode${quote}: ${quote}import${quote} }`
        );
      } else {
        out.push(rawLiteral);
      }
      pushToken('string', rawLiteral);
      stmtStart = false;
      continue;
    }

    // Template literal
    if (ch === '`') {
      const start = i;
      i++;
      let depth = 0;
      while (i < source.length) {
        if (source[i] === '\\') {
          i += 2;
          continue;
        }
        if (source[i] === '$' && source[i + 1] === '{') {
          depth++;
          i += 2;
          continue;
        }
        if (source[i] === '}' && depth > 0) {
          depth--;
          i++;
          continue;
        }
        if (source[i] === '`' && depth === 0) {
          i++;
          break;
        }
        i++;
      }
      const rawTemplate = source.slice(start, i);
      out.push(rawTemplate);
      pushToken('template', rawTemplate);
      stmtStart = false;
      continue;
    }

    // Identifier
    if (/[A-Za-z_$]/.test(ch)) {
      const start = i;
      i++;
      while (i < source.length && /[A-Za-z0-9_$]/.test(source[i])) {
        i++;
      }
      const ident = source.slice(start, i);
      const isStmtKeyword =
        braceDepth === 0 &&
        prev1?.value !== '.' &&
        STATEMENT_RESET_KEYWORDS.has(ident) &&
        !(ident === 'type' && prev1?.type === 'ident' && (prev1.value === 'import' || prev1.value === 'export'));
      if (stmtStart || isStmtKeyword) {
        isImportTypeStmt = false;
      }
      if (prev1?.type === 'ident' && prev1.value === 'import' && ident === 'type') {
        isImportTypeStmt = true;
      }
      out.push(ident);
      pushToken('ident', ident);
      stmtStart = false;
      continue;
    }

    // Punctuation / other character
    if (ch === '{') {
      braceDepth++;
    } else if (ch === '}' && braceDepth > 0) {
      braceDepth--;
    }
    out.push(ch);
    pushToken('punct', ch);
    stmtStart = ch === ';';
    if (stmtStart) {
      isImportTypeStmt = false;
    }
    i++;
  }

  return out.join('').replace(/\r\n/g, '\n');
}

function runTsc(tscBin, args, cwd) {
  try {
    execFileSync(process.execPath, [tscBin, ...args], {
      cwd,
      encoding: 'utf8',
      stdio: 'pipe'
    });
  } catch (err) {
    const details = [err.stdout, err.stderr].filter(Boolean).join('\n').trim();
    throw new Error(`tsc failed: ${details || err.message}`);
  }
}

function collectEsmDependencies(targetRoot) {
  const esmDeps = new Set();
  const pkgPath = join(targetRoot, 'package.json');
  if (!existsSync(pkgPath)) {
    return esmDeps;
  }
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  if (pkg.type === 'module') {
    return esmDeps;
  }
  for (const depName of Object.keys(pkg.dependencies ?? {})) {
    const depPkgPath = join(targetRoot, 'node_modules', ...depName.split('/'), 'package.json');
    if (existsSync(depPkgPath)) {
      const depPkg = JSON.parse(readFileSync(depPkgPath, 'utf8'));
      if (depPkg.type === 'module') {
        esmDeps.add(depName);
      }
    }
  }
  return esmDeps;
}

function findNearestExistingAncestor(targetPath, stopAt) {
  let current = targetPath;
  while (!existsSync(current)) {
    if (current === stopAt) {
      break;
    }
    const parent = dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  return current;
}

export function validateOutDir(targetRoot, rawOutDir) {
  const realTargetRoot = realpathSync(targetRoot);
  const outDir = resolve(targetRoot, rawOutDir);

  if (!isWithinRoot(targetRoot, outDir) || outDir === targetRoot) {
    throw new Error(`Invalid output directory "${outDir}": must be a subdirectory inside ${targetRoot}`);
  }

  for (const reserved of PROTECTED_INTERNAL_DIRS) {
    const reservedPath = join(targetRoot, reserved);
    if (isWithinRoot(reservedPath, outDir)) {
      throw new Error(`Invalid output directory "${outDir}": cannot target reserved directory "${reserved}"`);
    }
  }

  const parentDir = dirname(outDir);
  const existingParent = findNearestExistingAncestor(parentDir, targetRoot);
  let realExistingParent;
  try {
    realExistingParent = realpathSync(existingParent);
  } catch (err) {
    throw new Error(`Invalid output directory "${outDir}": cannot resolve parent directory: ${err.message}`);
  }
  if (!isWithinRoot(realTargetRoot, realExistingParent)) {
    throw new Error(`Invalid output directory "${outDir}": parent resolves outside ${targetRoot} via symlink`);
  }

  const resolvedOutDir = resolveRealPath(outDir);
  if (!isSameOrSubpath(resolvedOutDir, realTargetRoot) || isSameOrSubpath(realTargetRoot, resolvedOutDir)) {
    throw new Error(`Invalid output directory "${outDir}": resolves outside ${targetRoot} via symlink`);
  }
  for (const reserved of PROTECTED_INTERNAL_DIRS) {
    const reservedReal = resolveRealPath(join(targetRoot, reserved));
    if (isSameOrSubpath(resolvedOutDir, reservedReal)) {
      throw new Error(`Invalid output directory "${outDir}": resolves inside reserved directory "${reserved}"`);
    }
  }

  let outLstat = null;
  try {
    outLstat = lstatSync(outDir);
  } catch (err) {
    if (err?.code !== 'ENOENT') {
      throw new Error(`Invalid output directory "${outDir}": ${err.message}`);
    }
  }
  if (outLstat) {
    let realOutDir;
    try {
      realOutDir = realpathSync(outDir);
    } catch (err) {
      throw new Error(`Invalid output directory "${outDir}": cannot resolve target: ${err.message}`);
    }
    if (!isWithinRoot(realTargetRoot, realOutDir) || realOutDir === realTargetRoot) {
      throw new Error(`Invalid output directory "${outDir}": resolves outside ${targetRoot} via symlink`);
    }
    if (outLstat.isSymbolicLink()) {
      throw new Error(`Invalid output directory "${outDir}": cannot be a symbolic link`);
    }
    if (!outLstat.isDirectory()) {
      throw new Error(`Invalid output directory "${outDir}": target exists and is not a directory`);
    }
  }

  return outDir;
}

function collectFilesStrict(dirPath, rootLabel) {
  const results = [];

  function walk(currentDir) {
    const entries = readdirSync(currentDir, { withFileTypes: true }).sort((a, b) =>
      compareCodePoints(a.name, b.name)
    );
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`Unexpected symlink in ${rootLabel}: ${relative(dirPath, fullPath)}`);
      }
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        results.push(fullPath);
      }
    }
  }

  walk(dirPath);
  return results;
}

export function isPackagedDistArtifact(relPath) {
  const norm = String(relPath).replace(/\\/g, '/');
  return norm === 'SHA256SUMS.txt' || norm.startsWith('assets/');
}

function compareDeclarationTrees(expectedDir, actualDir, targetRoot) {
  const relOut = relative(targetRoot, actualDir).replace(/\\/g, '/') || '.';
  const isDefaultDist = relOut === 'dist';
  const actualFiles = collectFilesStrict(actualDir, `${relOut}/`).filter(
    (f) => !(isDefaultDist && isPackagedDistArtifact(relative(actualDir, f)))
  );
  const nonDts = actualFiles.filter((f) => !f.endsWith('.d.ts'));
  if (nonDts.length > 0) {
    const sample = nonDts
      .slice(0, 5)
      .map((f) => relative(actualDir, f).replace(/\\/g, '/'))
      .join(', ');
    throw new Error(`Unexpected non-.d.ts file(s) in ${relOut}/: ${sample}`);
  }

  const expectedRel = collectFiles(expectedDir, () => true)
    .map((f) => relative(expectedDir, f).replace(/\\/g, '/'))
    .sort(compareCodePoints);
  const actualRel = actualFiles
    .map((f) => relative(actualDir, f).replace(/\\/g, '/'))
    .sort(compareCodePoints);

  const expectedSet = new Set(expectedRel);
  const actualSet = new Set(actualRel);
  const missing = expectedRel.filter((rel) => !actualSet.has(rel));
  const extra = actualRel.filter((rel) => !expectedSet.has(rel));
  const drifted = [];

  for (const rel of expectedRel) {
    if (!actualSet.has(rel)) {
      continue;
    }
    const expectedBuf = readFileSync(join(expectedDir, rel));
    const actualBuf = readFileSync(join(actualDir, rel));
    if (Buffer.compare(expectedBuf, actualBuf) !== 0) {
      drifted.push(rel);
    }
  }

  if (missing.length > 0 || extra.length > 0 || drifted.length > 0) {
    const parts = [];
    if (missing.length > 0) {
      parts.push(`missing (${missing.length}): ${missing.slice(0, 5).join(', ')}`);
    }
    if (extra.length > 0) {
      parts.push(`extra (${extra.length}): ${extra.slice(0, 5).join(', ')}`);
    }
    if (drifted.length > 0) {
      parts.push(`drifted (${drifted.length}): ${drifted.slice(0, 5).join(', ')}`);
    }
    throw new Error(`Declaration output ${relOut}/ is out of date (${parts.join('; ')}). Run "npm run generate".`);
  }
}

export function generateDeclarations(options = {}) {
  const targetRoot = resolve(options.rootDir ?? root);
  const libDir = join(targetRoot, 'lib');
  const check = Boolean(options.check);

  if (!existsSync(libDir) || !statSync(libDir).isDirectory()) {
    throw new Error(`Missing lib/ directory at ${libDir}`);
  }

  const outDir = validateOutDir(targetRoot, options.outDir ?? 'dist');
  if (check && (!existsSync(outDir) || !statSync(outDir).isDirectory())) {
    throw new Error(`Missing output directory "${outDir}" for --check; run "npm run generate" first.`);
  }

  const tscBin = join(targetRoot, 'node_modules', 'typescript', 'bin', 'tsc');
  if (!existsSync(tscBin)) {
    throw new Error(`Missing TypeScript CLI at ${tscBin}`);
  }

  const libEntry = join(libDir, 'index.ts');
  if (!existsSync(libEntry)) {
    throw new Error(`Missing library entry point at ${libEntry}`);
  }

  const stagingDir = join(dirname(outDir), `.tmp-dist-${process.pid}-${Date.now()}`);
  mkdirSync(stagingDir, { recursive: true });

  try {
    // 1. Emit raw .d.ts files from lib/ into stagingDir (zero .js output)
    runTsc(
      tscBin,
      [
        '--ignoreConfig',
        '--target',
        'es2020',
        '--lib',
        'es2020,dom',
        '--module',
        'esnext',
        '--moduleResolution',
        'bundler',
        '--strict',
        '--declaration',
        '--emitDeclarationOnly',
        '--newLine',
        'lf',
        '--rootDir',
        libDir,
        '--outDir',
        stagingDir,
        libEntry
      ],
      targetRoot
    );

    const emittedFiles = collectFiles(stagingDir, () => true);
    const nonDtsFiles = emittedFiles.filter((file) => !file.endsWith('.d.ts'));
    if (nonDtsFiles.length > 0) {
      const sample = nonDtsFiles.slice(0, 5).map((f) => relative(stagingDir, f)).join(', ');
      throw new Error(`Unexpected non-.d.ts file(s) emitted: ${sample}`);
    }

    // 2. Assert 1:1 parity with lib/**/*.ts
    const expectedRelDts = collectFiles(libDir, (_, name) => name.endsWith('.ts'))
      .map((f) => relative(libDir, f).replace(/\.ts$/, '.d.ts'))
      .sort(compareCodePoints);
    const actualRelDts = emittedFiles
      .map((f) => relative(stagingDir, f))
      .sort(compareCodePoints);

    if (
      expectedRelDts.length !== actualRelDts.length ||
      expectedRelDts.some((rel, idx) => rel !== actualRelDts[idx])
    ) {
      const actualSet = new Set(actualRelDts);
      const missing = expectedRelDts.filter((rel) => !actualSet.has(rel));
      throw new Error(
        `Declaration parity mismatch (expected ${expectedRelDts.length}, got ${actualRelDts.length}); missing: ${missing.slice(0, 5).join(', ')}`
      );
    }

    // 3. Rewrite relative specifiers to explicit .js / /index.js extensions
    const realStagingDir = realpathSync(stagingDir);
    const esmPackages = collectEsmDependencies(targetRoot);
    for (const dtsFile of emittedFiles) {
      const raw = readFileSync(dtsFile, 'utf8');
      const rewritten = rewriteDeclarationSpecifiers(raw, dtsFile, stagingDir, realStagingDir, esmPackages);
      writeFileSync(dtsFile, rewritten, 'utf8');
    }

    // 4. Verify generated declaration tree under strict node16 module resolution
    runTsc(
      tscBin,
      [
        '--ignoreConfig',
        '--noEmit',
        '--target',
        'es2020',
        '--lib',
        'es2020,dom',
        '--module',
        'node16',
        '--moduleResolution',
        'node16',
        '--strict',
        join(stagingDir, 'index.d.ts')
      ],
      targetRoot
    );

    if (check) {
      compareDeclarationTrees(stagingDir, outDir, targetRoot);
      return {
        count: emittedFiles.length,
        outDir,
        checked: true
      };
    }

    // 5. Atomically swap verified declarations into outDir
    rmSync(outDir, { recursive: true, force: true });
    renameSync(stagingDir, outDir);

    return {
      count: emittedFiles.length,
      outDir,
      checked: false
    };
  } finally {
    rmSync(stagingDir, { recursive: true, force: true });
  }
}

if (isDirectCli(import.meta.url)) {
  let targetRoot = root;
  let outDir = 'dist';
  let check = false;
  const argv = process.argv.slice(2);

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--root') {
      const val = argv[++i];
      if (!val || val.startsWith('-')) {
        console.error('✖ Generate failed: --root requires a directory path');
        process.exit(1);
      }
      targetRoot = resolve(val);
    } else if (arg.startsWith('--root=')) {
      const val = arg.slice('--root='.length);
      if (!val) {
        console.error('✖ Generate failed: --root requires a directory path');
        process.exit(1);
      }
      targetRoot = resolve(val);
    } else if (arg === '--out-dir') {
      const val = argv[++i];
      if (!val || val.startsWith('-')) {
        console.error('✖ Generate failed: --out-dir requires a directory path');
        process.exit(1);
      }
      outDir = val;
    } else if (arg.startsWith('--out-dir=')) {
      const val = arg.slice('--out-dir='.length);
      if (!val) {
        console.error('✖ Generate failed: --out-dir requires a directory path');
        process.exit(1);
      }
      outDir = val;
    } else if (arg === '--check') {
      check = true;
    } else {
      console.error(`✖ Generate failed: Unknown option "${arg}"`);
      process.exit(1);
    }
  }

  try {
    const result = generateDeclarations({ rootDir: targetRoot, outDir, check });
    const relOut = relative(targetRoot, result.outDir).replace(/\\/g, '/') || '.';
    if (result.checked) {
      console.log(`✔ Verified ${result.count} node16-clean .d.ts declaration(s) in ${relOut}/ match lib/.`);
    } else {
      console.log(
        `✔ Generated ${result.count} node16-clean .d.ts declaration(s) into ${relOut}/ (0 .js files emitted).`
      );
    }
  } catch (err) {
    console.error(`✖ Generate failed: ${err.message}`);
    process.exit(1);
  }
}

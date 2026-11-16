// Release asset packager for @kidthales/pgmmv-types:
// Packs the package tarball via `npm pack --ignore-scripts --pack-destination` into `dist/assets/`
// and writes `dist/SHA256SUMS.txt` covering the packed `.tgz` and `LICENSE`.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertSafeWriteTarget, isDirectCli, isSameOrSubpath, parseCliOutDir, resolveOutDir, resolveRealPath } from './path-jail.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function sha256Hex(content) {
  return createHash('sha256').update(content).digest('hex');
}

function assertSafeAssetsDir(assetsDir, baseDir) {
  if (!isSameOrSubpath(assetsDir, baseDir)) {
    throw new Error(`Invalid assetsDir: refusing to access path outside outDir jail: ${assetsDir}`);
  }
  let st;
  try {
    st = lstatSync(assetsDir);
  } catch (err) {
    if (err?.code === 'ENOENT') {
      return false;
    }
    throw err;
  }
  if (st.isSymbolicLink()) {
    throw new Error(`Invalid assetsDir: refusing to traverse symbolic link at ${assetsDir}`);
  }
  if (!st.isDirectory()) {
    throw new Error(`Invalid assetsDir: expected directory at ${assetsDir}`);
  }
  return true;
}

export function resolveNpmCommand(args) {
  const npmExecPath = process.env.npm_execpath;
  if (
    typeof npmExecPath === 'string' &&
    /(?:^|[\\/])npm(?:-cli)?\.(?:m|c)?js$/i.test(npmExecPath) &&
    existsSync(npmExecPath)
  ) {
    return { command: process.execPath, args: [npmExecPath, ...args] };
  }

  const nodeDir = dirname(process.execPath);
  const candidates = [
    join(nodeDir, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    join(nodeDir, '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return { command: process.execPath, args: [candidate, ...args] };
    }
  }

  if (process.platform === 'win32') {
    const whereOut = execFileSync('where.exe', ['npm'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    for (const line of whereOut.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const winCandidate = join(dirname(trimmed), 'node_modules', 'npm', 'bin', 'npm-cli.js');
      if (existsSync(winCandidate)) {
        return { command: process.execPath, args: [winCandidate, ...args] };
      }
    }
    throw new Error('Unable to locate npm-cli.js on Windows without shell invocation.');
  }

  return { command: 'npm', args };
}

function parsePackedFilename(stdout) {
  const trimmed = stdout.trim();
  if (!trimmed) {
    throw new Error('npm pack --json produced empty stdout');
  }
  const parsed = JSON.parse(trimmed);
  if (!Array.isArray(parsed) || parsed.length !== 1 || typeof parsed[0]?.filename !== 'string') {
    throw new Error(`Unexpected npm pack --json output: ${trimmed}`);
  }
  const rawName = parsed[0].filename.trim();
  if (!rawName || rawName !== basename(rawName) || rawName.includes('..') || !rawName.endsWith('.tgz')) {
    throw new Error(`Invalid tarball filename returned by npm pack: '${rawName}'`);
  }
  return rawName;
}

function cleanupOtherTarballs(assetsDir, keepName) {
  const removed = [];
  for (const entry of readdirSync(assetsDir, { withFileTypes: true })) {
    if ((entry.isFile() || entry.isSymbolicLink()) && entry.name.endsWith('.tgz') && entry.name !== keepName) {
      unlinkSync(join(assetsDir, entry.name));
      removed.push(entry.name);
    }
  }
  return removed;
}

function purgeExistingSums(targetDist) {
  const sumsPath = join(targetDist, 'SHA256SUMS.txt');
  let st;
  try {
    st = lstatSync(sumsPath);
  } catch (err) {
    if (err?.code === 'ENOENT') {
      return;
    }
    throw err;
  }
  if (st.isDirectory()) {
    throw new Error(`Invalid SHA256SUMS.txt: expected file at ${sumsPath}`);
  }
  if (st.isSymbolicLink()) {
    throw new Error(`Invalid SHA256SUMS.txt: refusing to traverse symbolic link at ${sumsPath}`);
  }
  assertSafeWriteTarget(sumsPath, targetDist);
  unlinkSync(sumsPath);
}

/**
 * Packages the npm tarball into `<outDir>/assets/*.tgz` and writes `<outDir>/SHA256SUMS.txt`.
 */
export function packageAssets(opts = {}) {
  if (opts === null || typeof opts !== 'object' || Array.isArray(opts)) {
    throw new Error('Invalid options: must be an object');
  }
  if ('rootDir' in opts && opts.rootDir !== undefined && (typeof opts.rootDir !== 'string' || opts.rootDir.trim() === '')) {
    throw new Error('Invalid rootDir: must be a non-empty string path');
  }

  const targetRoot = resolveRealPath(opts.rootDir ?? root);
  const pkgPath = join(targetRoot, 'package.json');
  const licensePath = join(targetRoot, 'LICENSE');
  const generatedEntryPath = join(targetRoot, 'dist', 'index.d.ts');

  if (!existsSync(pkgPath)) {
    throw new Error(`Cannot package assets: package.json not found at ${pkgPath}`);
  }
  if (!existsSync(licensePath)) {
    throw new Error(`Cannot package assets: LICENSE not found at ${licensePath}`);
  }
  if (!existsSync(generatedEntryPath)) {
    throw new Error(`Cannot package assets: generated declarations missing at ${generatedEntryPath}. Run npm run generate first.`);
  }

  const outDirOpts = { rootDir: targetRoot };
  if ('outDir' in opts) {
    outDirOpts.outDir = opts.outDir;
  }
  if ('allowedRoot' in opts) {
    outDirOpts.allowedRoot = opts.allowedRoot;
  }
  const targetDist = resolveOutDir(outDirOpts);

  const assetsDir = join(targetDist, 'assets');
  if (assertSafeAssetsDir(assetsDir, targetDist)) {
    cleanupOtherTarballs(assetsDir, '');
  }
  purgeExistingSums(targetDist);

  const tempPackDir = mkdtempSync(join(tmpdir(), 'pgmmv_pack_'));
  let tarballName;
  let tarballBuf;
  try {
    const npmInv = resolveNpmCommand(['pack', '--ignore-scripts', '--pack-destination', tempPackDir, '--json']);
    let packStdout;
    try {
      packStdout = execFileSync(npmInv.command, npmInv.args, {
        cwd: targetRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err) {
      const details = [err.stdout, err.stderr].filter(Boolean).join('\n').trim();
      throw new Error(`npm pack failed: ${details || err.message}`);
    }

    tarballName = parsePackedFilename(packStdout);
    const stagedTarballPath = assertSafeWriteTarget(join(tempPackDir, tarballName), tempPackDir);
    if (!existsSync(stagedTarballPath)) {
      throw new Error(`Expected packed tarball not found at ${stagedTarballPath}`);
    }
    tarballBuf = readFileSync(stagedTarballPath);
  } finally {
    rmSync(tempPackDir, { recursive: true, force: true });
  }

  assertSafeAssetsDir(assetsDir, targetDist);
  mkdirSync(assetsDir, { recursive: true });
  const tarballPath = assertSafeWriteTarget(join(assetsDir, tarballName), assetsDir);
  writeFileSync(tarballPath, tarballBuf);
  cleanupOtherTarballs(assetsDir, tarballName);

  const licenseBuf = readFileSync(licensePath);

  const releaseAssets = [
    { name: 'LICENSE', buf: licenseBuf },
    { name: tarballName, buf: tarballBuf },
  ].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  const sha256Sums = releaseAssets.map((asset) => `${sha256Hex(asset.buf)}  ${asset.name}`).join('\n') + '\n';
  const sha256SumsPath = assertSafeWriteTarget(join(targetDist, 'SHA256SUMS.txt'), targetDist);
  writeFileSync(sha256SumsPath, sha256Sums, 'utf8');

  return {
    tarballPath,
    tarballName,
    tarballBytes: tarballBuf.length,
    sha256SumsPath,
    assets: releaseAssets.map((a) => ({ name: a.name, bytes: a.buf.length, sha256: sha256Hex(a.buf) })),
  };
}

if (isDirectCli(import.meta.url)) {
  const argv = process.argv.slice(2);
  let targetRoot = root;
  const outDirArgv = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--root') {
      const val = argv[++i];
      if (!val || val.startsWith('-')) {
        console.error('✖ Package assets failed: --root requires a directory path');
        process.exit(1);
      }
      targetRoot = resolve(val);
    } else if (arg.startsWith('--root=')) {
      const val = arg.slice('--root='.length);
      if (!val.trim()) {
        console.error('✖ Package assets failed: --root requires a directory path');
        process.exit(1);
      }
      targetRoot = resolve(val);
    } else if (arg === '--outDir' || arg === '--outdir') {
      outDirArgv.push(arg);
      if (i + 1 < argv.length) {
        outDirArgv.push(argv[++i]);
      }
    } else if (arg.startsWith('--outDir=') || arg.startsWith('--outdir=')) {
      outDirArgv.push(arg);
    } else {
      console.error(`✖ Package assets failed: Unknown option "${arg}"`);
      process.exit(1);
    }
  }

  try {
    const cliOutDir = parseCliOutDir(outDirArgv);
    const opts = cliOutDir !== undefined ? { rootDir: targetRoot, outDir: cliOutDir } : { rootDir: targetRoot };
    const result = packageAssets(opts);
    console.log(
      `✔ Packaged ${result.tarballName} (${result.tarballBytes} B) and wrote SHA256SUMS.txt (${result.assets.length} asset(s)).`,
    );
  } catch (err) {
    console.error(`✖ Package assets failed: ${err.message}`);
    process.exit(1);
  }
}

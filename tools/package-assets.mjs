// Release asset packager for @kidthales/pgmmv-types:
// Packs the package tarball via `npm pack --ignore-scripts --pack-destination` into `dist/assets/`
// and writes `dist/SHA256SUMS.txt` covering the packed `.tgz` and `LICENSE`.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
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

function resolveNpmCommand(args) {
  const npmExecPath = process.env.npm_execpath;
  if (typeof npmExecPath === 'string' && /\.(?:m|c)?js$/i.test(npmExecPath) && existsSync(npmExecPath)) {
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

/**
 * Packages the npm tarball into `<outDir>/assets/*.tgz` and writes `<outDir>/SHA256SUMS.txt`.
 */
export function packageAssets(opts = {}) {
  if (opts === null || typeof opts !== 'object' || Array.isArray(opts)) {
    throw new Error('Invalid options: must be an object');
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

  const rawOutDir = 'outDir' in opts ? opts.outDir : join(targetRoot, 'dist');
  const targetDist = resolveOutDir({
    outDir: rawOutDir,
    allowedRoot: opts.allowedRoot ?? targetRoot,
  });

  const assetsDir = join(targetDist, 'assets');
  assertSafeAssetsDir(assetsDir, targetDist);
  mkdirSync(assetsDir, { recursive: true });

  const npmInv = resolveNpmCommand(['pack', '--ignore-scripts', '--pack-destination', assetsDir, '--json']);
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

  const tarballName = parsePackedFilename(packStdout);
  const tarballPath = assertSafeWriteTarget(join(assetsDir, tarballName), assetsDir);
  if (!existsSync(tarballPath)) {
    throw new Error(`Expected packed tarball not found at ${tarballPath}`);
  }

  cleanupOtherTarballs(assetsDir, tarballName);

  const tarballBuf = readFileSync(tarballPath);
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
    const opts = cliOutDir ? { rootDir: targetRoot, outDir: cliOutDir } : { rootDir: targetRoot };
    const result = packageAssets(opts);
    console.log(
      `✔ Packaged ${result.tarballName} (${result.tarballBytes} B) and wrote SHA256SUMS.txt (${result.assets.length} asset(s)).`,
    );
  } catch (err) {
    console.error(`✖ Package assets failed: ${err.message}`);
    process.exit(1);
  }
}

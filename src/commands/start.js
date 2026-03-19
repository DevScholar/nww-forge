import path from 'node:path';
import fs from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { loadForgeConfig, readPackageJson, resolveMainEntry } from '../utils/forge-config.js';
import { info, error } from '../utils/log.js';

function parseArgs(args) {
  let runtime = 'node';
  for (const arg of args) {
    if (arg.startsWith('--runtime=')) runtime = arg.slice(10);
  }
  return { runtime };
}

function findEsbuild(cwd) {
  const isWin = process.platform === 'win32';
  const local = path.join(cwd, 'node_modules', '.bin', isWin ? 'esbuild.cmd' : 'esbuild');
  if (fs.existsSync(local)) return { cmd: local, pre: [] };
  return { cmd: isWin ? 'npx.cmd' : 'npx', pre: ['esbuild'] };
}

export default async function start(args) {
  const { runtime } = parseArgs(args);
  const cwd = process.cwd();
  const isWin = process.platform === 'win32';
  const pkg = readPackageJson(cwd);
  await loadForgeConfig(cwd); // future: detect Vite plugin

  const mainEntry = resolveMainEntry(cwd, pkg);
  if (!fs.existsSync(mainEntry)) {
    error(`Main entry not found: ${mainEntry}`);
    process.exit(1);
  }

  const isTs = mainEntry.endsWith('.ts');

  if (!isTs) {
    // Plain JS: run directly
    info(`Starting ${path.relative(cwd, mainEntry)} with ${runtime}...`);
    const runArgs = runtime === 'deno'
      ? ['run', '--allow-all', mainEntry]
      : [mainEntry];
    const proc = spawn(runtime, runArgs, { stdio: 'inherit', cwd });
    proc.on('exit', code => process.exit(code ?? 0));
  } else {
    // TypeScript: compile with esbuild first
    const outfile = path.join(cwd, 'dist', 'main.js');
    fs.mkdirSync(path.dirname(outfile), { recursive: true });

    const { cmd: esbuild, pre } = findEsbuild(cwd);
    const external = isWin ? '@devscholar/node-ps1-dotnet' : '@devscholar/node-with-gjs';

    info(`Building ${path.relative(cwd, mainEntry)}...`);
    const build = spawnSync(
      esbuild,
      [...pre, mainEntry, '--bundle', `--outfile=${outfile}`, '--format=esm',
       '--platform=node', '--target=node18', '--sourcemap', `--external:${external}`],
      { stdio: 'inherit', cwd, shell: isWin }
    );
    if (build.status !== 0) process.exit(build.status ?? 1);

    info(`Running with ${runtime}...`);
    const runArgs = runtime === 'deno'
      ? ['run', '--allow-all', outfile]
      : [outfile];
    const proc = spawn(runtime, runArgs, { stdio: 'inherit', cwd });
    proc.on('exit', code => process.exit(code ?? 0));
  }
}

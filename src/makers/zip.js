import path from 'node:path';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { info, ok, warn, error } from '../utils/log.js';

/**
 * Zip maker: creates a .zip archive of the packaged app directory.
 *
 * Uses PowerShell Compress-Archive on Windows, `zip` CLI on Linux.
 */
export async function make({ outDir, appName, version, platform, arch, makeDir }) {
  const zipName = `${appName}-${version}-${platform}-${arch}.zip`;
  const zipPath = path.join(makeDir, zipName);

  fs.mkdirSync(makeDir, { recursive: true });
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

  info(`Creating ${zipName}...`);

  if (process.platform === 'win32') {
    const result = spawnSync(
      'powershell.exe',
      ['-NoProfile', '-Command',
       `Compress-Archive -Path '${outDir}\\*' -DestinationPath '${zipPath}' -Force`],
      { stdio: 'inherit' }
    );
    if (result.status !== 0) {
      error('PowerShell Compress-Archive failed.');
      process.exit(1);
    }
  } else {
    const result = spawnSync(
      'zip', ['-r', zipPath, '.'],
      { stdio: 'inherit', cwd: outDir }
    );
    if (result.status !== 0) {
      error('zip command failed. Make sure `zip` is installed.');
      process.exit(1);
    }
  }

  ok(`Created ${path.relative(process.cwd(), zipPath)}`);
  return zipPath;
}

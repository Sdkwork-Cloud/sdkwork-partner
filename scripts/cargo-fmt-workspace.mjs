#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { relative, resolve } from 'node:path';
import process from 'node:process';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: process.platform === 'win32' && command.endsWith('.cmd'),
    windowsHide: process.platform === 'win32',
    ...options,
  });
  if (result.error) {
    throw result.error;
  }
  return result;
}

function runInherited(command, args) {
  const result = run(command, args, { stdio: 'inherit' });
  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
}

function readCargoMetadata() {
  const result = run('cargo', ['metadata', '--format-version', '1', '--no-deps']);
  if ((result.status ?? 1) !== 0) {
    process.stderr.write(result.stderr || result.stdout);
    process.exit(result.status ?? 1);
  }
  return JSON.parse(result.stdout);
}

function normalizeCargoFmtArgs(args) {
  if (args[0] === 'fmt') {
    return args.slice(1);
  }
  return args;
}

function commandPathEquals(left, right) {
  return resolve(left).toLowerCase() === resolve(right).toLowerCase();
}

function resolveCargoFmtCommand() {
  const configured = process.env.SDKWORK_CLOUDROUTER_CARGO_FMT_BINARY?.trim();
  if (configured) {
    return configured;
  }

  const rustup = run('rustup', ['which', 'cargo-fmt']);
  const rustupCandidate = rustup.stdout?.trim();
  if ((rustup.status ?? 1) === 0 && rustupCandidate) {
    return rustupCandidate;
  }

  if (process.platform === 'win32') {
    const currentShim = resolve(process.cwd(), 'cargo-fmt.cmd');
    const where = run('where.exe', ['cargo-fmt']);
    if ((where.status ?? 1) === 0) {
      const candidate = where.stdout
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter(Boolean)
        .find((line) => !commandPathEquals(line, currentShim));
      if (candidate) {
        return candidate;
      }
    }
  } else {
    const command = run('sh', ['-lc', 'command -v cargo-fmt']);
    const candidate = command.stdout?.trim();
    if ((command.status ?? 1) === 0 && candidate) {
      return candidate;
    }
  }

  return 'cargo-fmt';
}

function shouldDelegateToCargoFmt(args) {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--') {
      return false;
    }
    if (arg === '--help' || arg === '-h' || arg === '--version') {
      return true;
    }
    if (
      arg === '-p'
      || arg === '--package'
      || arg.startsWith('--package=')
      || arg === '--manifest-path'
      || arg.startsWith('--manifest-path=')
    ) {
      return true;
    }
  }
  return false;
}

function workspaceCargoFmtArgs(args) {
  return args.filter((arg) => arg !== '--all');
}

function shouldFormatWorkspacePackage(pkg) {
  // Every sdkwork-partner workspace member is formatted by this script;
  // sibling SDKWork dependencies are formatted by their own workspaces.
  return true;
}

function formatWorkspace({ args }) {
  const cargoFmtCommand = resolveCargoFmtCommand();
  if (shouldDelegateToCargoFmt(args)) {
    runInherited(cargoFmtCommand, args);
    return;
  }

  const metadata = readCargoMetadata();
  const packagesById = new Map(metadata.packages.map((pkg) => [pkg.id, pkg]));
  const workspacePackages = metadata.workspace_members
    .map((id) => packagesById.get(id))
    .filter(Boolean)
    .sort((left, right) => left.name.localeCompare(right.name));
  const formattablePackages = workspacePackages.filter(shouldFormatWorkspacePackage);
  const rootFormattedPackages = workspacePackages.filter((pkg) => !shouldFormatWorkspacePackage(pkg));
  const forwardedArgs = workspaceCargoFmtArgs(args);
  const quiet = forwardedArgs.includes('-q') || forwardedArgs.includes('--quiet');

  for (const pkg of formattablePackages) {
    const manifestPath = relative(process.cwd(), pkg.manifest_path);
    const packageArgs = ['--manifest-path', manifestPath, ...forwardedArgs];
    if (!quiet) {
      console.error(`[cargo-fmt-workspace] ${pkg.name}: ${cargoFmtCommand} ${packageArgs.join(' ')}`);
    }
    runInherited(cargoFmtCommand, packageArgs);
  }

  if (rootFormattedPackages.length > 0) {
    const rootArgs = [
      'fmt',
      ...forwardedArgs,
      ...rootFormattedPackages.flatMap((pkg) => ['-p', pkg.name]),
    ];
    if (!quiet) {
      console.error(`[cargo-fmt-workspace] root: cargo ${rootArgs.join(' ')}`);
    }
    runInherited('cargo', rootArgs);
  }
}

const args = process.argv.slice(2);
formatWorkspace({
  args: normalizeCargoFmtArgs(args),
});

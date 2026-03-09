import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const projectRoot = process.cwd();
const standaloneRoot = path.join(projectRoot, '.next', 'standalone');
const publicSource = path.join(projectRoot, 'public');
const staticSource = path.join(projectRoot, '.next', 'static');

const ensureDir = (dir) => {
  fs.mkdirSync(dir, { recursive: true });
};

const copyIfExists = (source, destination) => {
  if (!fs.existsSync(source)) {
    return;
  }

  ensureDir(path.dirname(destination));
  fs.cpSync(source, destination, { recursive: true, force: true });
};

const findServerEntry = (root) => {
  const directEntry = path.join(root, 'server.js');
  if (fs.existsSync(directEntry)) {
    return directEntry;
  }

  const queue = [root];
  while (queue.length > 0) {
    const current = queue.shift();
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);

      if (entry.isDirectory()) {
        queue.push(fullPath);
        continue;
      }

      if (entry.isFile() && entry.name === 'server.js') {
        return fullPath;
      }
    }
  }

  return null;
};

if (!fs.existsSync(standaloneRoot)) {
  console.error('Standalone build not found. Run `npm run build` first.');
  process.exit(1);
}

copyIfExists(publicSource, path.join(standaloneRoot, 'public'));
copyIfExists(staticSource, path.join(standaloneRoot, '.next', 'static'));
copyIfExists(
  staticSource,
  path.join(standaloneRoot, 'public', '_next', 'static'),
);

const serverEntry = findServerEntry(standaloneRoot);

if (!serverEntry) {
  console.error(
    'Could not find the standalone server entry. Run `npm run build` again.',
  );
  process.exit(1);
}

const child = spawn(process.execPath, [serverEntry], {
  cwd: projectRoot,
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

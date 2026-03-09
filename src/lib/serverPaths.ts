import fs from 'fs';
import path from 'path';

const resolveAppRoot = () => {
  if (process.env.DATA_DIR) {
    return path.resolve(process.env.DATA_DIR);
  }

  const candidates = [
    process.cwd(),
    path.resolve(process.cwd(), '..'),
    path.resolve(process.cwd(), '..', '..'),
  ];

  for (const candidate of candidates) {
    const hasDataDir = fs.existsSync(path.join(candidate, 'data'));
    const hasDrizzleDir = fs.existsSync(path.join(candidate, 'drizzle'));

    if (hasDataDir || hasDrizzleDir) {
      return candidate;
    }
  }

  return process.cwd();
};

export const APP_ROOT = resolveAppRoot();
export const DATA_ROOT = path.join(APP_ROOT, 'data');
export const DRIZZLE_ROOT = path.join(APP_ROOT, 'drizzle');

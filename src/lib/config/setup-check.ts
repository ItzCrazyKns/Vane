import fs from 'node:fs';
import path from 'node:path';

/**
 * Lightweight setup completion check for use in middleware.
 * Reads config.json directly to avoid importing the full config/provider chain.
 */
export function isSetupComplete(): boolean {
  try {
    const configPath = path.join(
      process.env.DATA_DIR || process.cwd(),
      '/data/config.json',
    );
    const raw = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(raw);
    return config.setupComplete === true;
  } catch {
    return false;
  }
}

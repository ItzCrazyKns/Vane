/**
 * CLI tool for managing user accounts.
 *
 * Usage:
 *   npx tsx scripts/manage-users.ts add --username alice --password secret [--role admin]
 *   npx tsx scripts/manage-users.ts remove --username alice
 *   npx tsx scripts/manage-users.ts reset-password --username alice --password newsecret
 *   npx tsx scripts/manage-users.ts list
 */

import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import crypto from 'crypto';

const DATA_DIR = process.env.DATA_DIR || process.cwd();
const dbPath = path.join(DATA_DIR, 'data', 'db.sqlite');

let db: Database.Database;
try {
  db = new Database(dbPath);
} catch (err) {
  console.error(`Failed to open database at ${dbPath}`);
  console.error(
    'Make sure the database exists (run the app first to initialize it).',
  );
  process.exit(1);
}

// Ensure users table exists
const tableExists = db
  .prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='users'",
  )
  .get();

if (!tableExists) {
  console.error(
    'Users table not found. Run the app first to apply migrations.',
  );
  process.exit(1);
}

function parseArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--') && i + 1 < args.length) {
      result[args[i].slice(2)] = args[i + 1];
      i++;
    }
  }
  return result;
}

const command = process.argv[2];
const flags = parseArgs(process.argv.slice(3));

async function main() {
  switch (command) {
    case 'add': {
      if (!flags.username || !flags.password) {
        console.error('Usage: add --username <name> --password <pass> [--role admin|user]');
        process.exit(1);
      }

      const existing = db
        .prepare('SELECT id FROM users WHERE username = ?')
        .get(flags.username);

      if (existing) {
        console.error(`User "${flags.username}" already exists.`);
        process.exit(1);
      }

      const id = crypto.randomUUID();
      const passwordHash = await bcrypt.hash(flags.password, 10);
      const role = flags.role === 'admin' ? 'admin' : 'user';

      db.prepare(
        'INSERT INTO users (id, username, passwordHash, role, createdAt) VALUES (?, ?, ?, ?, ?)',
      ).run(id, flags.username, passwordHash, role, new Date().toISOString());

      console.log(
        `User "${flags.username}" created (role: ${role}, id: ${id})`,
      );
      break;
    }

    case 'remove': {
      if (!flags.username) {
        console.error('Usage: remove --username <name>');
        process.exit(1);
      }

      const user = db
        .prepare('SELECT id FROM users WHERE username = ?')
        .get(flags.username) as { id: string } | undefined;

      if (!user) {
        console.error(`User "${flags.username}" not found.`);
        process.exit(1);
      }

      db.prepare('DELETE FROM sessions WHERE userId = ?').run(user.id);
      db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
      console.log(`User "${flags.username}" removed.`);
      break;
    }

    case 'reset-password': {
      if (!flags.username || !flags.password) {
        console.error('Usage: reset-password --username <name> --password <newpass>');
        process.exit(1);
      }

      const user = db
        .prepare('SELECT id FROM users WHERE username = ?')
        .get(flags.username) as { id: string } | undefined;

      if (!user) {
        console.error(`User "${flags.username}" not found.`);
        process.exit(1);
      }

      const newHash = await bcrypt.hash(flags.password, 10);
      db.prepare('UPDATE users SET passwordHash = ? WHERE id = ?').run(
        newHash,
        user.id,
      );

      // Invalidate existing sessions
      db.prepare('DELETE FROM sessions WHERE userId = ?').run(user.id);
      console.log(
        `Password reset for "${flags.username}". All sessions invalidated.`,
      );
      break;
    }

    case 'list': {
      const users = db
        .prepare('SELECT id, username, role, createdAt FROM users ORDER BY createdAt')
        .all() as { id: string; username: string; role: string; createdAt: string }[];

      if (users.length === 0) {
        console.log('No users found.');
      } else {
        console.log(`\n${'Username'.padEnd(20)} ${'Role'.padEnd(8)} ${'Created'.padEnd(24)} ID`);
        console.log('-'.repeat(80));
        users.forEach((u) => {
          console.log(
            `${u.username.padEnd(20)} ${u.role.padEnd(8)} ${u.createdAt.padEnd(24)} ${u.id}`,
          );
        });
        console.log(`\nTotal: ${users.length} user(s)`);
      }
      break;
    }

    default:
      console.error('Unknown command. Available: add, remove, reset-password, list');
      process.exit(1);
  }
}

main()
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  })
  .finally(() => {
    db.close();
  });

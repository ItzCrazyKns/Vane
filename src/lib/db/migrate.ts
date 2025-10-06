import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DATA_DIR = process.env.DATA_DIR || process.cwd();
const dbPath = path.join(DATA_DIR, './data/db.sqlite');

const db = new Database(dbPath);

const migrationsFolder = path.join(DATA_DIR, 'drizzle');

db.exec(`
  CREATE TABLE IF NOT EXISTS ran_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    run_on DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

function sanitizeSql(content: string) {
  return content
    .split(/\r?\n/)
    .filter(
      (l) => !l.trim().startsWith('-->') && !l.includes('statement-breakpoint'),
    )
    .join('\n');
}

fs.readdirSync(migrationsFolder)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .forEach((file) => {
    const filePath = path.join(migrationsFolder, file);
    let content = fs.readFileSync(filePath, 'utf-8');
    content = sanitizeSql(content);

    const migrationName = file.split('_')[0] || file;

    const already = db
      .prepare('SELECT 1 FROM ran_migrations WHERE name = ?')
      .get(migrationName);
    if (already) {
      console.log(`Skipping already-applied migration: ${file}`);
      return;
    }

    try {
      if (migrationName === '0001') {
        const messages = db
          .prepare(
            'SELECT id, type, metadata, content, chatId, messageId FROM messages',
          )
          .all();

        db.exec(`
                    CREATE TABLE IF NOT EXISTS messages_with_sources (
                        id INTEGER PRIMARY KEY,
                        type TEXT NOT NULL,
                        chatId TEXT NOT NULL,
                        createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        messageId TEXT NOT NULL,
                        content TEXT,
                        sources TEXT DEFAULT '[]'
                    );
                `);

        const insertMessage = db.prepare(`
                    INSERT INTO messages_with_sources (type, chatId, createdAt, messageId, content, sources)
                    VALUES (?, ?, ?, ?, ?, ?)
                `);

        messages.forEach((msg: any) => {
          while (typeof msg.metadata === 'string') {
            msg.metadata = JSON.parse(msg.metadata || '{}');
          }
          if (msg.type === 'user') {
            insertMessage.run(
              'user',
              msg.chatId,
              msg.metadata['createdAt'],
              msg.messageId,
              msg.content,
              '[]',
            );
          } else if (msg.type === 'assistant') {
            insertMessage.run(
              'assistant',
              msg.chatId,
              msg.metadata['createdAt'],
              msg.messageId,
              msg.content,
              '[]',
            );
            const sources = msg.metadata['sources'] || '[]';
            if (sources && sources.length > 0) {
              insertMessage.run(
                'source',
                msg.chatId,
                msg.metadata['createdAt'],
                `${msg.messageId}-source`,
                '',
                JSON.stringify(sources),
              );
            }
          }
        });

        db.exec('DROP TABLE messages;');
        db.exec('ALTER TABLE messages_with_sources RENAME TO messages;');
      } else {
        db.exec(content);
      }

      db.prepare('INSERT OR IGNORE INTO ran_migrations (name) VALUES (?)').run(
        migrationName,
      );
      console.log(`Applied migration: ${file}`);
    } catch (err) {
      console.error(`Failed to apply migration ${file}:`, err);
      throw err;
    }
  });

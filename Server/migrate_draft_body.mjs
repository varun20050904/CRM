import { createPool } from 'mysql2';
import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '.env') });

const required = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required env variable: ${key}`);
    process.exit(1);
  }
}

const db = createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306
});

db.query(
  "SELECT COUNT(*) AS cnt FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'reminders' AND column_name = 'draft_body'",
  (err, res) => {
    if (err) {
      console.error('Check error:', err.message);
      db.end();
      return;
    }

    if (res[0].cnt === 0) {
      db.query('ALTER TABLE reminders ADD COLUMN draft_body TEXT DEFAULT NULL', (err2) => {
        if (err2) console.error('Migration error:', err2.message);
        else console.log('draft_body column added successfully.');
        db.end();
      });
    } else {
      console.log('Column already exists, nothing to do.');
      db.end();
    }
  }
);

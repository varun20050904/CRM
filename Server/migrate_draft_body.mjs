import { createPool } from 'mysql2';

const db = createPool({ host: 'localhost', user: 'root', password: 'root@123', database: 'crm', port: 3306 });

db.query(
  "SELECT COUNT(*) AS cnt FROM information_schema.columns WHERE table_schema='crm' AND table_name='reminders' AND column_name='draft_body'",
  (err, res) => {
    if (err) { console.error('Check error:', err.message); db.end(); return; }
    if (res[0].cnt === 0) {
      db.query('ALTER TABLE reminders ADD COLUMN draft_body TEXT DEFAULT NULL', (err2) => {
        if (err2) console.error('Migration error:', err2.message);
        else console.log('✓ draft_body column added successfully.');
        db.end();
      });
    } else {
      console.log('✓ Column already exists, nothing to do.');
      db.end();
    }
  }
);

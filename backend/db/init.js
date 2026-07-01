// db/init.js
// Run this once to create the database tables in Turso: npm run init-db
// Safe to run again later — it won't wipe existing data (uses IF NOT EXISTS).
require('dotenv').config();
const db = require('./connection');
const bcrypt = require('bcryptjs');
// require('dotenv').config();

async function main() {
  console.log('Initializing database on Turso:', process.env.TURSO_DATABASE_URL);

<<<<<<< HEAD
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      token_version INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migration for databases created before token_version existed.
  try {
    await db.exec(`ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0;`);
    console.log('Migrated: added token_version column to users.');
  } catch (err) {
    // Column already exists — fine, ignore.
  }
=======
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    token_version INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

// Migration for databases created before token_version existed.
try {
  db.exec(`ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0;`);
  console.log('Migrated: added token_version column to users.');
} catch (err) {
  // Column already exists — fine, ignore.
}

db.exec(`
  CREATE TABLE IF NOT EXISTS consignment_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lr_no TEXT UNIQUE NOT NULL,
    lr_date TEXT NOT NULL,
    edd TEXT,
    booking_mode TEXT,
>>>>>>> 0ec00a2bee8e0cd5d50a66cb6dcdf034160b77b0

  await db.exec(`
    CREATE TABLE IF NOT EXISTS consignment_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lr_no TEXT UNIQUE NOT NULL,
      lr_date TEXT NOT NULL,
      edd TEXT,
      booking_mode TEXT,

<<<<<<< HEAD
      origin TEXT,
      destination TEXT,
=======
    consignor_name_address TEXT,
    consignor_gstin TEXT,
    consignor_mobile TEXT,
    consignor_email TEXT,
    consignee_name_address TEXT,
    consignee_gstin TEXT,
>>>>>>> 0ec00a2bee8e0cd5d50a66cb6dcdf034160b77b0

      consignor_name_address TEXT,
      consignor_gstin TEXT,
      consignor_mobile TEXT,
      consignor_email TEXT,
      consignee_name_address TEXT,
      consignee_gstin TEXT,

      vehicle_no TEXT,
      driver_name TEXT,
      driver_mobile TEXT,
      vehicle_type TEXT,

      eway_bill_no TEXT,
      eway_validity TEXT,
      invoice_no TEXT,
      invoice_date TEXT,
      invoice_value TEXT,

      insurance_detail TEXT,

      pkgs_nos TEXT,
      packing_type TEXT,
      goods_description TEXT,
      actual_wt TEXT,
      charged_wt TEXT,
      customer_ref_no TEXT,

      vehicle_in_time TEXT,
      vehicle_out_time TEXT,
      gst_payable_by TEXT,
      risk_type TEXT,

      remarks TEXT,

<<<<<<< HEAD
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
=======
// Migrations for consignment_notes columns added after initial release.
for (const col of ['consignor_mobile', 'consignor_email']) {
  try {
    db.exec(`ALTER TABLE consignment_notes ADD COLUMN ${col} TEXT;`);
    console.log(`Migrated: added ${col} column to consignment_notes.`);
  } catch (err) {
    // Column already exists — fine, ignore.
  }
}

// Create the default admin user if none exists yet.
const existing = db.prepare('SELECT COUNT(*) as count FROM users').get();
>>>>>>> 0ec00a2bee8e0cd5d50a66cb6dcdf034160b77b0

  // Migrations for consignment_notes columns added after initial release.
  for (const col of ['consignor_mobile', 'consignor_email']) {
    try {
      await db.exec(`ALTER TABLE consignment_notes ADD COLUMN ${col} TEXT;`);
      console.log(`Migrated: added ${col} column to consignment_notes.`);
    } catch (err) {
      // Column already exists — fine, ignore.
    }
  }

  // Create the default admin user if none exists yet.
  const existing = await db.prepare('SELECT COUNT(*) as count FROM users').get();

  if (Number(existing.count) === 0) {
    const username = process.env.ADMIN_USERNAME || 'admin';
    const password = process.env.ADMIN_PASSWORD || 'mahadev@2026';
    const hash = bcrypt.hashSync(password, 10);

    await db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, hash);

    console.log('---------------------------------------------');
    console.log('Default admin user created:');
    console.log('  username:', username);
    console.log('  password:', password);
    console.log('IMPORTANT: change this password after first login,');
    console.log('or set ADMIN_USERNAME / ADMIN_PASSWORD in your .env');
    console.log('file before running this script for the first time.');
    console.log('---------------------------------------------');
  } else {
    console.log('Users table already has an account — skipping admin creation.');
  }

  console.log('Database ready.');
  await db.close();
}

main().catch((err) => {
  console.error('Database initialization failed:', err);
  process.exit(1);
});

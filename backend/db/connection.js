// db/connection.js
//
// Uses Turso (libSQL) as the database — a hosted, network-accessible
// SQLite-compatible database. This replaces the old local file-based
// SQLite setup, which was wiped every time Render redeployed the service
// (Render's free web services have an ephemeral filesystem).
//
// Turso uses the exact same SQL dialect as SQLite, so table definitions
// and queries are unchanged. The only real difference is that every call
// is now a network round-trip, so it's async — every db.prepare(...).get/
// .all/.run() call must be awaited by the caller.
//
// Required env vars (see .env.example):
//   TURSO_DATABASE_URL   e.g. libsql://your-db-name-yourusername.turso.io
//   TURSO_AUTH_TOKEN     the auth token generated for that database

const { createClient } = require('@libsql/client');

if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  console.error('FATAL: TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set in your .env file.');
  console.error('Create a free database at https://turso.tech and copy its URL + token.');
  process.exit(1);
}

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Thin wrapper so the rest of the app keeps using the same
// db.prepare(sql).get/.all/.run(...params) shape it used with node:sqlite —
// just async now. All call sites must `await` these.
class StatementWrapper {
  constructor(sql) {
    this.sql = sql;
  }
  async get(...params) {
    const result = await client.execute({ sql: this.sql, args: params });
    return result.rows[0] || undefined;
  }
  async all(...params) {
    const result = await client.execute({ sql: this.sql, args: params });
    return result.rows;
  }
  async run(...params) {
    const result = await client.execute({ sql: this.sql, args: params });
    return {
      lastInsertRowid: result.lastInsertRowid !== undefined ? Number(result.lastInsertRowid) : undefined,
      changes: result.rowsAffected,
    };
  }
}

const db = {
  async exec(sql) {
    // db/init.js sends one statement at a time, so a plain execute is fine.
    await client.execute(sql);
  },
  prepare(sql) {
    return new StatementWrapper(sql);
  },
  async close() {
    client.close();
  },
};

module.exports = db;

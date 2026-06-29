// db/connection.js
//
// Uses Node's BUILT-IN SQLite module (node:sqlite) instead of the
// better-sqlite3 npm package. This needs Node.js 22+ and requires NO
// compilation, no Visual Studio / build tools, no native addons at all —
// it ships inside Node itself. This avoids the "Could not find any
// Visual Studio installation" error that better-sqlite3 can cause on
// Windows.
//
// A thin wrapper below makes it behave like better-sqlite3's API
// (.prepare().get/.all/.run, .exec, .pragma) so the rest of the app
// doesn't need to change.

const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = path.join(__dirname, 'mahadev.db');
const rawDb = new DatabaseSync(dbPath);

class StatementWrapper {
  constructor(stmt) {
    this.stmt = stmt;
  }
  get(...params) {
    return this.stmt.get(...params);
  }
  all(...params) {
    return this.stmt.all(...params);
  }
  run(...params) {
    const info = this.stmt.run(...params);
    return { lastInsertRowid: info.lastInsertRowid, changes: info.changes };
  }
}

const db = {
  exec(sql) {
    rawDb.exec(sql);
  },
  prepare(sql) {
    return new StatementWrapper(rawDb.prepare(sql));
  },
  pragma(str) {
    try {
      rawDb.exec(`PRAGMA ${str}`);
    } catch (e) {
      // Some pragmas behave slightly differently here; safe to ignore.
    }
  },
  close() {
    rawDb.close();
  },
};

module.exports = db;

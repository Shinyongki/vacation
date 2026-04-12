const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let db = null;

function getDatabase() {
  if (db) return db;

  const dbPath = path.join(__dirname, '..', '..', 'data', 'leave-management.db');
  const dbDir = path.dirname(dbPath);

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(dbPath);

  // WAL 모드 설정
  db.pragma('journal_mode = WAL');
  // 외래키 제약 활성화
  db.pragma('foreign_keys = ON');

  return db;
}

function initializeDatabase() {
  const database = getDatabase();

  // 테이블 존재 여부 확인
  const tableExists = database.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='employees'"
  ).get();

  if (!tableExists) {
    // 스키마 실행
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    database.exec(schema);

    // 시드 데이터 실행
    const seedPath = path.join(__dirname, 'seed.sql');
    if (fs.existsSync(seedPath)) {
      const seed = fs.readFileSync(seedPath, 'utf-8');
      database.exec(seed);
    }

    console.log('Database initialized with schema and seed data');
  }

  return database;
}

function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { getDatabase, initializeDatabase, closeDatabase };

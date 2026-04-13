const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
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

    // 데모 계정 비밀번호를 생년월일 6자리(YYMMDD)로 해싱하여 업데이트
    seedDemoPasswords(database);

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

/**
 * 데모 계정 비밀번호를 생년월일 6자리(YYMMDD)로 해싱하여 업데이트.
 * 김직원(2024001)만 예외적으로 '6517' 사용.
 */
function seedDemoPasswords(database) {
  const OVERRIDES = { '2024001': '6517' };

  const employees = database.prepare(
    "SELECT id, employee_number, birth_date FROM employees"
  ).all();

  const update = database.prepare(
    "UPDATE employees SET password_hash = ?, is_initial_password = 0 WHERE id = ?"
  );

  for (const emp of employees) {
    let plainPassword;
    if (OVERRIDES[emp.employee_number]) {
      plainPassword = OVERRIDES[emp.employee_number];
    } else if (emp.birth_date) {
      // birth_date 'YYYY-MM-DD' → YYMMDD
      plainPassword = emp.birth_date.slice(2).replace(/-/g, '');
    } else {
      continue;
    }
    const hash = bcrypt.hashSync(plainPassword, 10);
    update.run(hash, emp.id);
  }
}

module.exports = { getDatabase, initializeDatabase, closeDatabase };

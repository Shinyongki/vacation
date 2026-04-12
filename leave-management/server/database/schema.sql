-- 휴가관리 시스템 DB 스키마 (18개 테이블)
-- Phase 0에서 확정 — 이후 Phase에서 수정 금지

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- 1. departments
CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  parent_id INTEGER REFERENCES departments(id)
);

-- 2. employees
CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_number TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('staff','team_lead','director','hr_admin','foundation')),
  department_id INTEGER NOT NULL REFERENCES departments(id),
  hire_date TEXT NOT NULL,
  birth_date TEXT NOT NULL,
  gender TEXT NOT NULL CHECK(gender IN ('M','F')),
  position TEXT NOT NULL,
  position_rank INTEGER DEFAULT 0,
  phone TEXT,
  employment_type TEXT NOT NULL DEFAULT 'regular' CHECK(employment_type IN ('regular','contract')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
  is_absent INTEGER NOT NULL DEFAULT 0,
  absent_return_date TEXT,
  is_initial_password INTEGER NOT NULL DEFAULT 1,
  resignation_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- 3. leave_types
CREATE TABLE IF NOT EXISTS leave_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  default_days INTEGER,
  requires_attachment INTEGER NOT NULL DEFAULT 0,
  allows_retroactive INTEGER NOT NULL DEFAULT 0,
  gender_restriction TEXT CHECK(gender_restriction IN (NULL, 'F'))
);

-- 4. condolence_subtypes
CREATE TABLE IF NOT EXISTS condolence_subtypes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  leave_type_id INTEGER NOT NULL REFERENCES leave_types(id),
  name TEXT NOT NULL,
  days INTEGER NOT NULL,
  description TEXT
);

-- 5. leave_requests
CREATE TABLE IF NOT EXISTS leave_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  leave_type_id INTEGER NOT NULL REFERENCES leave_types(id),
  condolence_subtype_id INTEGER REFERENCES condolence_subtypes(id),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  half_day_type TEXT CHECK(half_day_type IN (NULL, 'AM', 'PM', 'TIME')),
  time_start TEXT,
  time_end TEXT,
  total_days REAL NOT NULL,
  reason TEXT,
  is_urgent INTEGER NOT NULL DEFAULT 0,
  urgent_reason TEXT,
  is_retroactive INTEGER NOT NULL DEFAULT 0,
  retroactive_category TEXT,
  retroactive_detail TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('draft','pending','approved','rejected','recalled','cancelled')),
  parent_request_id INTEGER REFERENCES leave_requests(id),
  recall_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- 6. approval_flows
CREATE TABLE IF NOT EXISTS approval_flows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT
);

-- 7. approval_flow_steps
CREATE TABLE IF NOT EXISTS approval_flow_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  flow_id INTEGER NOT NULL REFERENCES approval_flows(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  step_type TEXT NOT NULL CHECK(step_type IN ('draft','cooperation','review','approval')),
  assignee_type TEXT NOT NULL CHECK(assignee_type IN ('self','role','department','person')),
  assignee_position TEXT,
  assignee_department_id INTEGER REFERENCES departments(id),
  assignee_employee_id INTEGER REFERENCES employees(id)
);

-- 8. approval_steps (Audit Trail — INSERT only)
CREATE TABLE IF NOT EXISTS approval_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL REFERENCES leave_requests(id),
  step_order INTEGER NOT NULL,
  step_type TEXT NOT NULL,
  assigned_to INTEGER NOT NULL REFERENCES employees(id),
  acted_by INTEGER REFERENCES employees(id),
  is_delegated INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending','approved','rejected')),
  approver_position TEXT,
  approver_dept_name TEXT,
  comment TEXT,
  read_at TEXT,
  acted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- 9. delegates
CREATE TABLE IF NOT EXISTS delegates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  delegate_id INTEGER NOT NULL REFERENCES employees(id),
  priority INTEGER NOT NULL CHECK(priority IN (1, 2)),
  UNIQUE(employee_id, priority)
);

-- 10. leave_balances
CREATE TABLE IF NOT EXISTS leave_balances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  year INTEGER NOT NULL,
  total_days REAL NOT NULL DEFAULT 0,
  used_days REAL NOT NULL DEFAULT 0,
  adjusted_days REAL NOT NULL DEFAULT 0,
  calc_detail TEXT,
  UNIQUE(employee_id, year)
);

-- 11. balance_adjustments (INSERT only)
CREATE TABLE IF NOT EXISTS balance_adjustments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  balance_id INTEGER NOT NULL REFERENCES leave_balances(id),
  adjusted_by INTEGER NOT NULL REFERENCES employees(id),
  amount REAL NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TRIGGER IF NOT EXISTS prevent_balance_adj_update BEFORE UPDATE ON balance_adjustments
BEGIN SELECT RAISE(ABORT, 'balance_adjustments 수정 불가'); END;

CREATE TRIGGER IF NOT EXISTS prevent_balance_adj_delete BEFORE DELETE ON balance_adjustments
BEGIN SELECT RAISE(ABORT, 'balance_adjustments 삭제 불가'); END;

-- 12. notifications
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  target_url TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- 13. holidays
CREATE TABLE IF NOT EXISTS holidays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  name TEXT NOT NULL,
  is_custom INTEGER NOT NULL DEFAULT 0,
  year INTEGER NOT NULL
);

-- 14. system_settings
CREATE TABLE IF NOT EXISTS system_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- 15. leave_type_flow_mapping
CREATE TABLE IF NOT EXISTS leave_type_flow_mapping (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  leave_type_id INTEGER NOT NULL REFERENCES leave_types(id),
  approval_flow_id INTEGER NOT NULL REFERENCES approval_flows(id),
  UNIQUE(leave_type_id)
);

-- 16. export_logs (INSERT only)
CREATE TABLE IF NOT EXISTS export_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exported_by INTEGER NOT NULL REFERENCES employees(id),
  export_type TEXT NOT NULL CHECK(export_type IN ('usage','summary')),
  date_from TEXT NOT NULL,
  date_to TEXT NOT NULL,
  verification_code TEXT NOT NULL,
  file_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TRIGGER IF NOT EXISTS prevent_export_log_update BEFORE UPDATE ON export_logs
BEGIN SELECT RAISE(ABORT, 'export_logs 수정 불가'); END;

CREATE TRIGGER IF NOT EXISTS prevent_export_log_delete BEFORE DELETE ON export_logs
BEGIN SELECT RAISE(ABORT, 'export_logs 삭제 불가'); END;

-- 17. leave_request_visibility (열람 범위)
CREATE TABLE IF NOT EXISTS leave_request_visibility (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL REFERENCES leave_requests(id),
  department_id INTEGER NOT NULL REFERENCES departments(id),
  UNIQUE(request_id, department_id)
);

-- 18. employment_type_leave_mapping (고용형태별 휴가)
CREATE TABLE IF NOT EXISTS employment_type_leave_mapping (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employment_type TEXT NOT NULL,
  leave_type_id INTEGER NOT NULL REFERENCES leave_types(id),
  is_allowed INTEGER NOT NULL DEFAULT 1,
  UNIQUE(employment_type, leave_type_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_employees_dept ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_number ON employees(employee_number);
CREATE INDEX IF NOT EXISTS idx_employees_type ON employees(employment_type);
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON leave_requests(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_approval_steps_request ON approval_steps(request_id);
CREATE INDEX IF NOT EXISTS idx_approval_steps_assigned ON approval_steps(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_notifications_employee ON notifications(employee_id, is_read);
CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date);
CREATE INDEX IF NOT EXISTS idx_leave_balances_ey ON leave_balances(employee_id, year);
CREATE INDEX IF NOT EXISTS idx_balance_adj_balance ON balance_adjustments(balance_id);
CREATE INDEX IF NOT EXISTS idx_export_logs_code ON export_logs(verification_code);
CREATE INDEX IF NOT EXISTS idx_visibility_request ON leave_request_visibility(request_id);
CREATE INDEX IF NOT EXISTS idx_visibility_dept ON leave_request_visibility(department_id);

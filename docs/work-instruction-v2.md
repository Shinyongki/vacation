# 휴가관리 시스템 — Claude Code 작업 지시서 v2.0

> 작성일: 2026.04.12
> 관련 문서: PRD v1.2, IA v1.2, Use Case v1.2, 데이터 무결성 검증 가이드 v1.0, 디자인 가이드 v1.0
> 목적: Claude Code에서 병렬 코딩 작업을 수행하기 위한 구체적 지시서

---

## 0. 프로젝트 개요

### 0.1 한 줄 요약

재단법인 경상남도사회서비스원 산하 시설에 납품할 **로컬 전용 휴가관리 시스템**. React + Node.js + Express + SQLite 기반, Node.js SEA로 .exe 단일 실행파일 패키징.

### 0.2 핵심 수치

| 항목 | 수치 |
|------|:----:|
| DB 테이블 | 18개 |
| API 엔드포인트 | 58개 (9개 도메인) |
| 화면 수 | 37개 (모달 7개 포함) |
| Use Case | 43개 |
| 사용자 역할 | 5개 |
| 휴가 유형 | 7가지 |
| 신청 상태값 | 6개 (draft, pending, approved, rejected, recalled, cancelled) |
| 알림 유형 | 9개 |
| 직원 등록 필드 | 11개 |

### 0.3 기술 스택

| 구분 | 기술 | 비고 |
|------|------|------|
| 프론트엔드 | React 18+ | Vite 번들러 |
| 백엔드 | Node.js + Express | REST API (JSON) |
| DB | SQLite (better-sqlite3) | 동기식 |
| 인증 | JWT (jsonwebtoken) | |
| 해시 | bcryptjs | 비밀번호 |
| 검증코드 | crypto (내장) | SHA-256 |
| 엑셀 | exceljs | 읽기 + 쓰기 |
| PDF | pdfkit | 보고서 생성 |
| ZIP | archiver | 엑셀+PDF 묶음 |
| 스케줄러 | node-cron | 대결 전환, 부재 해제 |
| 패키징 | Node.js SEA | .exe 단일 실행파일 |

### 0.4 디자인 방향

**공공기관(A) 기반 + SaaS(B) 마감** — 디자인 가이드 v1.0 참조. 핵심:
- 상단 헤더 44px 네이비(#1B3A5C) + 경로 바 28px
- 사이드바 192px, 아코디언 그룹 메뉴
- 카드: 0.5px 보더, 8px 라운드, 그림자 없음
- 테이블 기반 데이터, pill 배지, 결재 진행 도트
- 가이드 카드: 할 일이 있을 때만 노란 배너
- 시스템 폰트 (Malgun Gothic / 시스템 기본)

---

## 1. DB 스키마 (18개 테이블)

### 1.1 테이블 생성 순서 (외래키 의존)

```sql
-- 1. departments
CREATE TABLE departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  parent_id INTEGER REFERENCES departments(id)
);

-- 2. employees (v1.2: gender, phone, employment_type, resignation_date 추가)
CREATE TABLE employees (
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
CREATE TABLE leave_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  default_days INTEGER,
  requires_attachment INTEGER NOT NULL DEFAULT 0,
  allows_retroactive INTEGER NOT NULL DEFAULT 0,
  gender_restriction TEXT CHECK(gender_restriction IN (NULL, 'F'))
);

-- 4. condolence_subtypes
CREATE TABLE condolence_subtypes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  leave_type_id INTEGER NOT NULL REFERENCES leave_types(id),
  name TEXT NOT NULL,
  days INTEGER NOT NULL,
  description TEXT
);

-- 5. leave_requests (v1.2: status 확장, parent_request_id, recall_reason)
CREATE TABLE leave_requests (
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
CREATE TABLE approval_flows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT
);

-- 7. approval_flow_steps
CREATE TABLE approval_flow_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  flow_id INTEGER NOT NULL REFERENCES approval_flows(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  step_type TEXT NOT NULL CHECK(step_type IN ('draft','cooperation','review','approval')),
  assignee_type TEXT NOT NULL CHECK(assignee_type IN ('self','role','department','person')),
  assignee_position TEXT,
  assignee_department_id INTEGER REFERENCES departments(id),
  assignee_employee_id INTEGER REFERENCES employees(id)
);

-- 8. approval_steps (Audit Trail)
CREATE TABLE approval_steps (
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
CREATE TABLE delegates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  delegate_id INTEGER NOT NULL REFERENCES employees(id),
  priority INTEGER NOT NULL CHECK(priority IN (1, 2)),
  UNIQUE(employee_id, priority)
);

-- 10. leave_balances
CREATE TABLE leave_balances (
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
CREATE TABLE balance_adjustments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  balance_id INTEGER NOT NULL REFERENCES leave_balances(id),
  adjusted_by INTEGER NOT NULL REFERENCES employees(id),
  amount REAL NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TRIGGER prevent_balance_adj_update BEFORE UPDATE ON balance_adjustments
BEGIN SELECT RAISE(ABORT, 'balance_adjustments 수정 불가'); END;
CREATE TRIGGER prevent_balance_adj_delete BEFORE DELETE ON balance_adjustments
BEGIN SELECT RAISE(ABORT, 'balance_adjustments 삭제 불가'); END;

-- 12. notifications
CREATE TABLE notifications (
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
CREATE TABLE holidays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  name TEXT NOT NULL,
  is_custom INTEGER NOT NULL DEFAULT 0,
  year INTEGER NOT NULL
);

-- 14. system_settings
CREATE TABLE system_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- 15. leave_type_flow_mapping
CREATE TABLE leave_type_flow_mapping (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  leave_type_id INTEGER NOT NULL REFERENCES leave_types(id),
  approval_flow_id INTEGER NOT NULL REFERENCES approval_flows(id),
  UNIQUE(leave_type_id)
);

-- 16. export_logs (INSERT only)
CREATE TABLE export_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exported_by INTEGER NOT NULL REFERENCES employees(id),
  export_type TEXT NOT NULL CHECK(export_type IN ('usage','summary')),
  date_from TEXT NOT NULL,
  date_to TEXT NOT NULL,
  verification_code TEXT NOT NULL,
  file_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TRIGGER prevent_export_log_update BEFORE UPDATE ON export_logs
BEGIN SELECT RAISE(ABORT, 'export_logs 수정 불가'); END;
CREATE TRIGGER prevent_export_log_delete BEFORE DELETE ON export_logs
BEGIN SELECT RAISE(ABORT, 'export_logs 삭제 불가'); END;

-- 17. leave_request_visibility (v1.1 신규 — 열람 범위)
CREATE TABLE leave_request_visibility (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL REFERENCES leave_requests(id),
  department_id INTEGER NOT NULL REFERENCES departments(id),
  UNIQUE(request_id, department_id)
);

-- 18. employment_type_leave_mapping (v1.2 신규 — 고용형태별 휴가)
CREATE TABLE employment_type_leave_mapping (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employment_type TEXT NOT NULL,
  leave_type_id INTEGER NOT NULL REFERENCES leave_types(id),
  is_allowed INTEGER NOT NULL DEFAULT 1,
  UNIQUE(employment_type, leave_type_id)
);

-- 인덱스
CREATE INDEX idx_employees_dept ON employees(department_id);
CREATE INDEX idx_employees_status ON employees(status);
CREATE INDEX idx_employees_number ON employees(employee_number);
CREATE INDEX idx_employees_type ON employees(employment_type);
CREATE INDEX idx_leave_requests_employee ON leave_requests(employee_id);
CREATE INDEX idx_leave_requests_status ON leave_requests(status);
CREATE INDEX idx_leave_requests_dates ON leave_requests(start_date, end_date);
CREATE INDEX idx_approval_steps_request ON approval_steps(request_id);
CREATE INDEX idx_approval_steps_assigned ON approval_steps(assigned_to, status);
CREATE INDEX idx_notifications_employee ON notifications(employee_id, is_read);
CREATE INDEX idx_holidays_date ON holidays(date);
CREATE INDEX idx_leave_balances_ey ON leave_balances(employee_id, year);
CREATE INDEX idx_balance_adj_balance ON balance_adjustments(balance_id);
CREATE INDEX idx_export_logs_code ON export_logs(verification_code);
CREATE INDEX idx_visibility_request ON leave_request_visibility(request_id);
CREATE INDEX idx_visibility_dept ON leave_request_visibility(department_id);
```

### 1.2 초기 데이터 (seed)

- 부서 3개 (경영지원팀, 사업운영팀, 돌봄서비스팀)
- 휴가 유형 7가지 (leave_types에 gender_restriction 설정: 생리휴가→'F', 출산휴가→'F')
- 경조사 세부유형 8가지 (2025.3.27 개정 반영)
- 시스템 설정 기본값 12개
- 데모 계정 5명 (직원, 팀장, 원장, HR관리자, 재단담당자)
- 2026년 공휴일 15개
- 고용형태별 휴가 매핑 기본값 (정규직: 7가지 전부, 계약직: 연차·병가·출산·생리만)

---

## 2. API 구조 (58개 엔드포인트)

| 도메인 | 경로 | 수 | 핵심 |
|--------|------|:--:|------|
| 인증 | /api/auth | 5 | login, logout, password, me, absence |
| 휴가 신청 | /api/leaves | **7** | CRUD, cancel, team-status, **recall, redraft** |
| 잔여일수 | /api/balances | 3 | me, team, adjust |
| 승인 관리 | /api/approvals | 5 | pending, approve, reject, batch, history |
| 대시보드 | /api/dashboard | 5 | staff, team-lead, director, hr, foundation |
| 알림 | /api/notifications | 3 | list, read, read-all |
| 캘린더 | /api/calendar | 2 | team(**열람범위 필터**), me |
| 관리자 | /api/admin | 22 | employees, leave-types, flows, delegates, holidays, settings, import |
| 보고서 | /api/reports | 3 | usage, summary, export(zip) |
| 검증 | /api/verification | 3 | verify, export-logs, adjustment-logs |

### 신규 API 상세

**POST /api/leaves/:id/recall** — 기안자 회수
```
권한: 기안자 본인만
조건: status === 'pending'
처리:
  1. leave_requests.status → 'recalled'
  2. leave_requests.recall_reason 저장 (선택)
  3. 진행 중인 approval_steps 초기화
  4. 관련 결재자에게 '회수됨' 알림
```

**POST /api/leaves/:id/redraft** — 재기안/재상신
```
권한: 기안자 본인만
조건: status === 'recalled' (재기안) 또는 'rejected' (재상신)
처리:
  1. 원본 건의 데이터 복사 → 새 leave_requests 생성 (status: pending)
  2. parent_request_id = 원본 건 ID
  3. leave_request_visibility도 복사
  4. 새 approval_steps 생성 (결재 라인 처음부터)
  5. 1단계 결재자에게 알림
  6. 응답: 새 건 ID + 원본 데이터 (프론트에서 수정 폼으로 표시)
```

---

## 3. 병렬 작업 트랙 설계

### 의존 관계

```
Phase 0 (공통 기반) — 반드시 먼저
  │
  ├──→ Phase 1 (4개 병렬)
  │     ├── Track A: 인증 + 사용자 관리
  │     ├── Track B: 연차 계산 엔진
  │     ├── Track C: 프론트엔드 쉘 + 공통 컴포넌트
  │     └── Track D: 관리자 CRUD (직원·부서·휴일·설정·고용형태)
  │
  ├──→ Phase 2 (3개 병렬, Phase 1 후)
  │     ├── Track E: 휴가 신청 + 결재 + 회수/재기안/재상신
  │     ├── Track F: 대시보드 5종
  │     └── Track G: 알림 시스템
  │
  ├──→ Phase 3 (2개 병렬, Phase 2 후)
  │     ├── Track H: 보고서 + 데이터 검증
  │     └── Track I: 대결 + 부재 + 스케줄러
  │
  └──→ Phase 4: 통합 + SEA 패키징
```

---

## 4. Phase별 상세

### Phase 0: 공통 기반

- 프로젝트 초기화, 의존성 설치
- DB 스키마 생성 (§1의 18개 테이블 전체)
- 초기 데이터 시드
- server/database/connection.js (better-sqlite3 싱글턴, WAL 모드)
- server/middleware/auth.js (JWT 검증)
- server/middleware/rbac.js (역할 기반 접근 제어)
- server/middleware/errorHandler.js
- client/src/api/client.js (axios 인스턴스, JWT 인터셉터)

### Phase 1: Track A — 인증

API 5개: login, logout, password, me, absence
- 로그인: 사번 조회 → bcrypt 비교 → JWT 발급 → is_initial_password 확인
- 비밀번호 변경: 현재 확인 → 새 비밀번호 해싱 → is_initial_password=0
- 부재 설정: team_lead/director만. is_absent, absent_return_date 업데이트
- 프론트: LoginPage, PasswordChangeModal, AuthContext, ProtectedRoute

### Phase 1: Track B — 연차 계산

서비스: leaveCalculator.js
- calculateAnnualLeave(hire_date, target_year) → { total_days, calc_detail }
- 규칙: 1년 미만 월 1일 / 1년+ 15일 / 3년+ 2년마다 +1 / 최대 25일
API 3개: GET /balances/me, GET /balances/team, POST /balances/adjust

### Phase 1: Track C — 프론트엔드 쉘

- App.jsx (라우팅), Sidebar.jsx (역할별 동적 메뉴)
- 상단 헤더 (44px 네이비) + 경로 바 (28px)
- NotificationPanel, AbsenceToggle, Badge, Calendar
- 공통 UI: DataTable, Modal, ProgressBar, StatusBadge, DatePicker, TimePicker
- **디자인 가이드 v1.0의 §2~§5 규격 준수 필수**

### Phase 1: Track D — 관리자 CRUD

API 22개 (HR관리자 전용)
- **직원 등록 필드 11개**: 사번, 이름, 부서, 직위, 역할, 입사일, 생년월일, **성별, 연락처, 고용형태**
- 퇴사 처리: status→inactive, **resignation_date 자동 기록**
- **고용형태별 휴가 매핑 관리** (employment_type_leave_mapping CRUD)
- 결재 라인, 대결자, 휴일, 시스템 설정, 엑셀 이전

### Phase 2: Track E — 휴가 신청 + 결재 ⭐

API 7개 (leaves) + 5개 (approvals)
**핵심 기능:**
- 신청 폼 3단계: 유형 선택 → 날짜/시간 → 확인+열람범위+상신
  - **성별 기반 유형 필터링** (남성: 생리·출산 비활성화)
  - **고용형태 기반 유형 필터링** (employment_type_leave_mapping 참조)
  - **열람 범위 설정** (팀별 체크박스 → leave_request_visibility)
- 결재 엔진 (approvalEngine.js): 결재 라인 생성, 순차 승인, 반려
- **회수** (POST /recall): pending→recalled, 결재 초기화
- **재기안** (POST /redraft from recalled): 데이터 복사 → 새 건 → parent_request_id 연결
- **재상신** (POST /redraft from rejected): 데이터 복사 + 반려 사유 표시
- 취소: pending→cancelled (종료, 재기안 불가)
- 결재 진행 도트 (테이블 인라인) + 결재 상세 모달 (타임라인)

**상태 전이:**
```
draft(미래) → pending → approved / rejected / recalled / cancelled
                         rejected → 재상신 → 새 pending
                         recalled → 재기안 → 새 pending
```

### Phase 2: Track F — 대시보드 5종

API 5개 (dashboard)
- 직원(D-01): 잔여 연차 36px, 계산 근거, 최근 신청, 가이드 카드
- 팀장(D-02): 팀 출근 현황, 승인 대기, 캘린더 미니뷰
- 원장(D-03): 할 일 요약, 대기 기간 (7일+ 강조)
- HR(D-04): 시스템 요약, 설정 바로가기
- 재단(D-05): 시설 현황 (열람 전용), 열람 근거 배너

### Phase 2: Track G — 알림 9가지

API 3개 (notifications)
유형: approval_request, approved, rejected, delegate_request, cancelled, urgent, auto_delegate, unprocessed_warning, **recalled**

**브라우저 알림 (Web Notification API):**
- 로그인 성공 후 `Notification.requestPermission()` 호출 → 사용자가 "허용" 클릭
- 30초마다 `GET /api/notifications?unread=true` 폴링으로 새 알림 감지
- 새 알림 발견 시 `new Notification(title, { body })` → 바탕화면 팝업 표시
- 팝업 클릭 시 `window.focus()` + `target_url`로 이동
- 시스템 탭이 열려있으면 다른 프로그램 사용 중에도 팝업 표시됨
- 인터넷 불필요 (로컬 네트워크에서 동작)

### Phase 3: Track H — 보고서 + 검증

API 3개 (reports) + 3개 (verification)
- 엑셀+PDF 동시 생성 → zip 다운로드
- PDF 마지막 페이지: 검증코드(SHA-256), 생성자, 기간, 요약
- export_logs INSERT only
- 재단: 검증코드 검증, 내보내기 이력, 조정 이력

### Phase 3: Track I — 대결 + 스케줄러

서비스: delegateRouter.js, scheduler.js
- 부재 시 1순위→2순위 대결 전환
- 동적 자동 전환: 긴급 즉시 / 단기 8시간 / 일반 24시간
- 50% 경과 시 미처리 경고
- 매일 자정 부재 복귀 자동 해제
- 매년 1/1 연차 자동 계산

### Phase 4: 통합 + 패키징

- 캘린더 API (열람 범위 기반 필터링)
- 현황·규정 화면
- SEA 패키징 (.exe)
- 통합 테스트

---

## 5. 비즈니스 규칙 체크리스트

### 신청 검증
- [ ] 성별 검증: 남성 → 생리휴가·출산휴가 신청 불가
- [ ] 고용형태 검증: employment_type_leave_mapping에서 is_allowed=0인 유형 신청 불가
- [ ] 잔여일수 검증: 연차 차감 시 잔여 >= 차감
- [ ] 사후 신청: 과거 날짜 + 6가지 사유 중 택1 + 연차·포상·생리는 불가
- [ ] 긴급: urgent_reason 필수 + 결재자·대결자 동시 알림
- [ ] 공휴일·자체휴일 차감 제외
- [ ] 시간연차: 점심시간 자동 제외, 8시간=1일
- [ ] 열람 범위: leave_request_visibility에 선택한 팀 저장

### 결재
- [ ] 순차 승인 (모든 단계 통과해야 최종 승인)
- [ ] 반려 → 전체 반려 + 사유 필수 + "재상신" 버튼 표시
- [ ] 회수 → recalled + 결재 초기화 + "재기안" 버튼 표시
- [ ] 취소 → cancelled + 잔여일수 복원 + 재기안 불가
- [ ] 최종 승인 → 잔여일수 차감 (트랜잭션)
- [ ] 결재 당시 직위·부서 스냅샷
- [ ] 결재 이력 수정·삭제 불가
- [ ] parent_request_id로 재상신/재기안 이력 추적

### 데이터 무결성
- [ ] approval_steps: 수정·삭제 불가
- [ ] balance_adjustments: INSERT only (트리거)
- [ ] export_logs: INSERT only (트리거)
- [ ] 퇴사자: status=inactive, resignation_date 기록, 데이터 보존

---

## 6. 트랙별 작업 시작 템플릿

```
[Track X 작업 시작]
참조 문서:
  - PRD v1.2 → FR-XX, BR-XX 섹션
  - IA v1.2 → 화면 ID, 정보 요소
  - Use Case v1.2 → UC-XX 상세 흐름
  - 디자인 가이드 v1.0 → 컴포넌트 규격, 색상
DB 스키마는 이미 생성되어 있습니다.
공통 미들웨어 (auth.js, rbac.js)는 이미 구현되어 있습니다.
```

---

## 7. 테스트 시나리오

### 시나리오 1: 기본 흐름
직원 등록(11필드) → 로그인 → 연차 신청(열람범위 설정) → 결재 → 승인 → 캘린더 표시 확인

### 시나리오 2: 회수 + 재기안
신청 → pending 상태에서 회수 → recalled → 재기안 → 날짜 수정 → 재상신 → 새 pending 건 확인

### 시나리오 3: 반려 + 재상신
신청 → 팀장 반려(사유 입력) → rejected → 재상신 → 반려 사유 표시 확인 → 날짜 수정 → 재상신

### 시나리오 4: 성별·고용형태 검증
남성 직원 로그인 → 신청 폼 → 생리휴가 비활성화 확인
계약직 직원 → 포상휴가 비활성화 확인 (HR설정에 따라)

### 시나리오 5: 보고서 검증
HR가 보고서 내보내기 → 재단 로그인 → 검증코드 확인 → 원본 확인

### 시나리오 6: 대결
팀장 부재 설정 → 직원 긴급 신청 → 대결자 즉시 전환 → 대결 처리 → 이력 확인

---

## 8. 역할별 API 접근 권한 매트릭스

| API | staff | team_lead | director | hr_admin | foundation |
|-----|:-----:|:---------:|:--------:|:--------:|:----------:|
| /auth | ✓ | ✓ | ✓ | ✓ | ✓ |
| /leaves (자기 건) | ✓ | ✓ | ✓ | ✓ | ✗ |
| /leaves/recall (자기 건) | ✓ | ✓ | ✓ | ✓ | ✗ |
| /leaves/redraft (자기 건) | ✓ | ✓ | ✓ | ✓ | ✗ |
| /balances/me | ✓ | ✓ | ✓ | ✓ | ✗ |
| /balances/team | ✗ | ✓ | ✓ | ✓ | ✗ |
| /balances/adjust | ✗ | ✗ | ✗ | ✓ | ✗ |
| /approvals | ✗ | ✓ | ✓ | ✗ | ✗ |
| /approvals/batch | ✗ | ✗ | ✓ | ✗ | ✗ |
| /dashboard | 역할별 | 역할별 | 역할별 | 역할별 | 역할별 |
| /notifications | ✓ | ✓ | ✓ | ✓ | ✗ |
| /calendar | ✓ | ✓ | ✓ | ✓ | ✗ |
| /admin | ✗ | ✗ | ✗ | ✓ | ✗ |
| /reports | ✗ | ✗ | ✓ | ✓ | ✓ |
| /verification | ✗ | ✗ | ✗ | ✗ | ✓ |

---

## 9. 오케스트라 병렬 코딩 실행 가이드

> Claude Code의 멀티 에이전트(오케스트라) 모드로 병렬 개발하기 위한 실행 지침.
> 각 Phase의 트랙들은 **파일 충돌 없이** 동시 작업 가능하도록 파일 소유권이 분리되어 있다.

### 9.1 실행 원칙

1. **Phase는 순차, Track은 병렬** — Phase 0 → 1 → 2 → 3 → 4 순서. 같은 Phase 내 Track들은 동시 실행
2. **파일 소유권 엄격 분리** — 각 Track이 생성/수정하는 파일이 겹치지 않음. 공통 파일(index.js, App.jsx)은 Phase 0 또는 Phase 4에서만 수정
3. **Phase Gate** — 다음 Phase로 넘어가기 전 현재 Phase 전체 완료 확인
4. **참조 문서** — 각 에이전트에게 이 작업 지시서 + PRD v1.2 + IA v1.2 + 디자인 가이드를 컨텍스트로 제공

### 9.2 파일 소유권 매트릭스

#### Phase 0 (단독 실행)
```
소유 파일:
  server/database/schema.sql
  server/database/seed.sql
  server/database/connection.js
  server/middleware/auth.js
  server/middleware/rbac.js
  server/middleware/errorHandler.js
  server/index.js              ← 뼈대만 (라우트 등록은 각 Track에서)
  client/src/main.jsx
  client/src/api/client.js
  package.json
  vite.config.js
```

#### Phase 1 (4개 병렬)

| 파일 | Track A | Track B | Track C | Track D |
|------|:-------:|:-------:|:-------:|:-------:|
| server/routes/auth.js | ✅ | | | |
| server/services/authService.js | ✅ | | | |
| client/src/components/auth/* | ✅ | | | |
| client/src/contexts/AuthContext.jsx | ✅ | | | |
| server/services/leaveCalculator.js | | ✅ | | |
| server/routes/balances.js | | ✅ | | |
| server/utils/dateUtils.js | | ✅ | | |
| server/utils/holidays.js | | ✅ | | |
| client/src/App.jsx | | | ✅ | |
| client/src/components/common/* | | | ✅ | |
| client/src/styles/* | | | ✅ | |
| client/src/hooks/* | | | ✅ | |
| server/routes/admin.js | | | | ✅ |
| client/src/components/admin/* | | | | ✅ |

#### Phase 2 (3개 병렬)

| 파일 | Track E | Track F | Track G |
|------|:-------:|:-------:|:-------:|
| server/routes/leaves.js | ✅ | | |
| server/routes/approvals.js | ✅ | | |
| server/services/approvalEngine.js | ✅ | | |
| client/src/components/leave/* | ✅ | | |
| client/src/components/approval/* | ✅ | | |
| server/routes/dashboard.js | | ✅ | |
| client/src/components/dashboard/* | | ✅ | |
| server/routes/notifications.js | | | ✅ |
| server/services/notificationService.js | | | ✅ |
| client/src/components/common/NotificationPanel.jsx | | | ✅ |
| client/src/contexts/NotificationContext.jsx | | | ✅ |

#### Phase 3 (2개 병렬)

| 파일 | Track H | Track I |
|------|:-------:|:-------:|
| server/routes/reports.js | ✅ | |
| server/routes/verification.js | ✅ | |
| server/services/reportGenerator.js | ✅ | |
| server/services/verificationService.js | ✅ | |
| client/src/components/report/* | ✅ | |
| client/src/components/verification/* | ✅ | |
| server/services/delegateRouter.js | | ✅ |
| server/services/scheduler.js | | ✅ |

#### Phase 4 (단독 실행)
```
소유 파일:
  server/index.js              ← 모든 라우트 통합 등록
  server/routes/calendar.js
  client/src/components/status/*
  client/src/App.jsx           ← 모든 라우트 통합
  scripts/build-sea.js
  sea-config.json
```

### 9.3 Phase별 실행 프롬프트

#### Phase 0 — 공통 기반 (단독, 1개 에이전트)

```
프로젝트 초기화를 수행해 주세요.

1. /leave-management 디렉토리 생성
2. package.json 초기화 + 의존성 설치:
   - express, better-sqlite3, jsonwebtoken, bcryptjs, cors
   - exceljs, pdfkit, archiver, multer, node-cron
   - react, react-dom, react-router-dom, axios, date-fns, lucide-react
   - vite, @vitejs/plugin-react (dev)
3. 작업 지시서 §1.1의 DB 스키마(18개 테이블) 전체를 schema.sql로 생성
4. §1.2의 초기 데이터를 seed.sql로 생성
5. server/database/connection.js 작성 (better-sqlite3 싱글턴, WAL 모드, foreign_keys ON)
6. server/middleware/auth.js 작성 (JWT 검증, req.user 설정)
7. server/middleware/rbac.js 작성 (requireRole(...roles) 함수)
8. server/middleware/errorHandler.js 작성
9. client/src/api/client.js 작성 (axios 인스턴스, JWT 인터셉터, 401 리다이렉트)
10. server/index.js 뼈대 작성 (Express 앱 생성, 미들웨어, 라우트 플레이스홀더)
11. vite.config.js 작성 (프록시: /api → localhost:3001)

참조: 작업 지시서 §1 DB 스키마 전체
```

#### Phase 1 — 4개 에이전트 동시 실행

**에이전트 1-A: 인증**
```
Track A: 인증 + 사용자 관리를 구현해 주세요.

파일 생성:
- server/routes/auth.js
- client/src/contexts/AuthContext.jsx
- client/src/components/auth/LoginPage.jsx
- client/src/components/auth/PasswordChangeModal.jsx
- client/src/components/auth/ProtectedRoute.jsx

API 5개:
- POST /api/auth/login (사번+비밀번호→JWT, 역할별 리다이렉트, inactive 차단)
- POST /api/auth/logout
- PUT /api/auth/password (현재 확인→새 해싱→is_initial_password=0)
- GET /api/auth/me (현재 사용자 정보)
- PUT /api/auth/absence (team_lead/director만, is_absent+absent_return_date)

LoginPage: 사번+비밀번호 입력, 데모 계정 안내(접이식)
PasswordChangeModal: 초기 비밀번호 시 강제 표시(닫기 불가)

디자인: 디자인 가이드 §2~§5 참조
⚠️ 다른 Track 파일 수정 금지
```

**에이전트 1-B: 연차 계산**
```
Track B: 연차 계산 엔진 + 잔여일수 API를 구현해 주세요.

파일 생성:
- server/services/leaveCalculator.js
- server/routes/balances.js
- server/utils/dateUtils.js
- server/utils/holidays.js

leaveCalculator.js:
- calculateAnnualLeave(hire_date, target_year) → { total_days, calc_detail }
- 규칙: 1년 미만 월 1일 / 1년+ 15일 / 3년+ 2년마다 +1 / 최대 25일
- calc_detail에 JSON으로 계산 과정 기록

API 3개:
- GET /api/balances/me (내 잔여일수 + 계산 근거)
- GET /api/balances/team (팀원 잔여일수, 팀장 이상)
- POST /api/balances/adjust (HR만, 사유 필수, balance_adjustments INSERT)

holidays.js: 공휴일·자체휴일 조회, 날짜 범위에서 휴일 제외 계산
dateUtils.js: 근속연수 계산, 날짜 차이, 영업일 계산

⚠️ 다른 Track 파일 수정 금지
```

**에이전트 1-C: 프론트엔드 쉘**
```
Track C: 프론트엔드 쉘 + 공통 컴포넌트를 구현해 주세요.

파일 생성:
- client/src/App.jsx (전체 라우팅 구조)
- client/src/components/common/Sidebar.jsx
- client/src/components/common/NotificationBell.jsx (벨 아이콘 + 배지만, 패널은 Track G)
- client/src/components/common/AbsenceToggle.jsx
- client/src/components/common/Badge.jsx
- client/src/components/common/Calendar.jsx
- client/src/components/common/DataTable.jsx
- client/src/components/common/Modal.jsx
- client/src/components/common/ProgressBar.jsx
- client/src/components/common/StatusBadge.jsx
- client/src/components/common/DatePicker.jsx
- client/src/components/common/TimePicker.jsx
- client/src/components/common/GuideCard.jsx (노란 가이드 카드)
- client/src/components/common/ApprovalDots.jsx (결재 진행 도트)
- client/src/styles/global.css
- client/src/hooks/useAuth.js
- client/src/hooks/useApi.js

디자인 가이드 v1.0의 전체 규격 엄격 준수:
- 상단 헤더 44px 네이비(#1B3A5C)
- 경로 바 28px (#EEF1F5)
- 사이드바 192px (#F6F7F9), 아코디언 그룹, 역할별 동적 메뉴
- 카드: 0.5px 보더 #DDE1E7, 8px 라운드
- 테이블: 8px 라운드, 헤더 #F3F5F7, 행 구분 0.5px #EEF0F2
- 배지: pill, 의미 색상 (디자인 가이드 §2.2)
- 버튼: Primary(#1B5E9E)/Secondary/Danger/Ghost, 6px 라운드
- 시스템 폰트 (font-family: -apple-system, "Malgun Gothic", sans-serif)

Sidebar 역할별 메뉴 (IA v1.2 §2.2 참조):
- 직원: 대시보드, 휴가 신청, 내 휴가 목록, 팀 캘린더, 휴가 규정
- 팀장: + 승인 관리, 팀원 현황
- 원장: + 전체 현황, 보고서
- HR관리자: 전체 + 관리자 설정
- 재단담당자: 시설 현황, 보고서, 데이터 검증

⚠️ 다른 Track 파일 수정 금지. 라우트 대상 컴포넌트는 플레이스홀더로 생성.
```

**에이전트 1-D: 관리자 CRUD**
```
Track D: 관리자 CRUD (HR관리자 전용)를 구현해 주세요.

파일 생성:
- server/routes/admin.js (22개 엔드포인트)
- client/src/components/admin/AdminSettings.jsx (탭 컨테이너)
- client/src/components/admin/EmployeeManagement.jsx (S-01)
- client/src/components/admin/LeaveTypeSettings.jsx (S-02, 고용형태별 휴가 매핑 포함)
- client/src/components/admin/ApprovalFlowSettings.jsx (S-03)
- client/src/components/admin/DelegateManagement.jsx (S-04)
- client/src/components/admin/HolidayManagement.jsx (S-05)
- client/src/components/admin/SystemSettings.jsx (S-06)
- client/src/components/admin/BalanceManagement.jsx (S-07)
- client/src/components/admin/ExcelUploadModal.jsx (S-08)

직원 등록 필드 11개: 사번, 이름, 부서, 직위, 역할, 입사일, 생년월일, 성별(M/F), 연락처, 고용형태(regular/contract)
- 초기 비밀번호 = birth_date 6자리 bcrypt 해싱
- 등록 시 leave_balances 자동 생성
퇴사 처리: status→inactive, resignation_date 자동 기록, 결재라인 제외
고용형태별 휴가 매핑: employment_type_leave_mapping CRUD (S-02 하단 체크박스 테이블)

디자인: 디자인 가이드 §5.12(직원 등록폼), §5.13(고용형태별 설정) 참조
⚠️ 다른 Track 파일 수정 금지
```

#### Phase 1 Gate Check
```
Phase 1 완료 확인:
□ auth API 5개 동작 (curl 테스트)
□ 로그인 → 역할별 대시보드 리다이렉트 (프론트)
□ leaveCalculator 단위 테스트 (입사일별 연차 계산)
□ balances API 3개 동작
□ Sidebar 역할별 메뉴 렌더링
□ 공통 컴포넌트 렌더링 (DataTable, Modal, Badge 등)
□ admin API 22개 동작
□ 직원 등록(11필드) → 로그인 가능 확인
□ 고용형태별 휴가 매핑 CRUD 동작
→ 모두 확인 후 Phase 2 시작
```

#### Phase 2 — 3개 에이전트 동시 실행

**에이전트 2-E: 휴가 신청 + 결재** ⭐
```
Track E: 휴가 신청 + 결재 엔진을 구현해 주세요. 이 시스템의 핵심 기능입니다.

파일 생성:
- server/routes/leaves.js (7개 엔드포인트)
- server/routes/approvals.js (5개 엔드포인트)
- server/services/approvalEngine.js
- client/src/components/leave/LeaveForm.jsx (L-03, 3단계 폼)
- client/src/components/leave/LeaveList.jsx (L-01)
- client/src/components/leave/LeaveDetail.jsx (L-02, 결재 상세 모달 포함)
- client/src/components/leave/CancelConfirmModal.jsx (L-04)
- client/src/components/leave/RecallConfirmModal.jsx (L-05)
- client/src/components/approval/ApprovalList.jsx (A-01)
- client/src/components/approval/ApprovalHistory.jsx (A-02)
- client/src/components/approval/RejectModal.jsx (A-03)
- client/src/components/approval/BatchApproveModal.jsx (A-04)

핵심 구현:
1. 신청 폼 3단계:
   - 1단계: 유형 선택 (성별 필터링 + 고용형태 필터링)
   - 2단계: 날짜/시간 (공휴일 제외, 시간연차 점심 제외)
   - 3단계: 확인 + 열람 범위(팀별 체크박스) + 사유 + 긴급/사후 + 상신
   → leave_requests INSERT + leave_request_visibility INSERT + approval_steps 생성

2. 결재 엔진 (approvalEngine.js):
   - createApprovalSteps(): 결재 라인 → approval_steps 생성
   - processApproval(): 승인/반려, 스냅샷, 다음 단계 알림
   - 최종 승인 시 트랜잭션: status=approved + used_days 차감

3. 회수 (POST /recall): pending→recalled, approval_steps 초기화
4. 재기안 (POST /redraft from recalled): 데이터 복사 → 새 건 (parent_request_id)
5. 재상신 (POST /redraft from rejected): 데이터 복사 + 반려 사유 표시

6. 결재 진행 UI:
   - 테이블 인라인: ApprovalDots (●—●—○)
   - 클릭 시 모달: 타임라인 (열람시각/결재시각 분리, 대결 표시, 반려 사유)

상태 전이: draft→pending→approved|rejected|recalled|cancelled
비즈니스 규칙: 작업 지시서 §5 체크리스트 전체 참조

⚠️ 알림 발송은 notificationService.notify() 호출만 (구현은 Track G)
⚠️ 다른 Track 파일 수정 금지
```

**에이전트 2-F: 대시보드**
```
Track F: 역할별 대시보드 5종을 구현해 주세요.

파일 생성:
- server/routes/dashboard.js (5개 엔드포인트)
- client/src/components/dashboard/DashboardRouter.jsx
- client/src/components/dashboard/StaffDashboard.jsx (D-01)
- client/src/components/dashboard/TeamLeadDashboard.jsx (D-02)
- client/src/components/dashboard/DirectorDashboard.jsx (D-03)
- client/src/components/dashboard/HRDashboard.jsx (D-04)
- client/src/components/dashboard/FoundationDashboard.jsx (D-05)

각 대시보드 데이터:
- D-01 직원: 잔여연차(36px #1B5E9E), 계산근거 테이블, 최근 신청, 가이드카드
- D-02 팀장: 팀 출근현황, 승인대기 건수 배지, 최근 요청, 캘린더 미니뷰
- D-03 원장: 할 일 요약(대기N/오래된N), 대기기간(7일+ 빨간), 출근율
- D-04 HR: 시스템 요약, 최근 변동, 설정 바로가기
- D-05 재단: 시설 현황(열람전용), 부서별 사용률, 열람근거 배너

디자인: 혼합 디자인 확정안 참조 (잔여일수 카드 + 계산근거 2열 + 테이블)
⚠️ 다른 Track 파일 수정 금지
```

**에이전트 2-G: 알림**
```
Track G: 알림 시스템(9가지 유형 + 브라우저 알림)을 구현해 주세요.

파일 생성:
- server/routes/notifications.js (3개 엔드포인트)
- server/services/notificationService.js
- client/src/components/common/NotificationPanel.jsx
- client/src/contexts/NotificationContext.jsx

notificationService.js:
- notify(employee_id, type, params) → notifications INSERT
- 9가지 유형: approval_request, approved, rejected, delegate_request,
  cancelled, urgent, auto_delegate, unprocessed_warning, recalled
- 각 유형별 제목/메시지 템플릿 + target_url

API 3개:
- GET /api/notifications (?unread=true, 최신순, 페이지네이션)
- PUT /api/notifications/:id/read
- PUT /api/notifications/read-all

NotificationPanel: 슬라이드 패널, 읽음/안읽음, 클릭→target_url 이동

브라우저 알림 (Web Notification API):
- 로그인 후 Notification.requestPermission()
- NotificationContext에서 30초마다 GET /notifications?unread=true 폴링
- 새 알림 감지 시 new Notification(title, { body }) → 바탕화면 팝업
- 팝업 클릭 시 window.focus() + target_url 이동

⚠️ 다른 Track 파일 수정 금지
```

#### Phase 2 Gate Check
```
Phase 2 완료 확인:
□ 휴가 신청 → 결재 → 승인 전체 흐름 동작
□ 회수 → 재기안 흐름 동작
□ 반려 → 재상신 흐름 동작 (반려 사유 표시)
□ 열람 범위 설정 → 승인 후 캘린더 반영 확인
□ 성별 검증 (남성 → 생리휴가 비활성화)
□ 고용형태 검증 (계약직 → 미허용 유형 비활성화)
□ 결재 진행 도트 + 상세 모달 동작
□ 5종 대시보드 각각 데이터 표시
□ 알림 9가지 유형 발송·표시·읽음 동작
□ 브라우저 알림 팝업 동작
→ 모두 확인 후 Phase 3 시작
```

#### Phase 3 — 2개 에이전트 동시 실행

**에이전트 3-H: 보고서 + 검증**
```
Track H: 보고서 생성 + 데이터 무결성 검증을 구현해 주세요.

파일 생성:
- server/routes/reports.js (3개)
- server/routes/verification.js (3개)
- server/services/reportGenerator.js
- server/services/verificationService.js
- client/src/components/report/ReportView.jsx (R-01, R-02)
- client/src/components/verification/VerificationView.jsx (탭 컨테이너)
- client/src/components/verification/ReportVerify.jsx (X-01)
- client/src/components/verification/ExportHistory.jsx (X-02)
- client/src/components/verification/AdjustmentHistory.jsx (X-03)

reportGenerator: exceljs(엑셀) + pdfkit(PDF) + archiver(zip)
- PDF 마지막 페이지: 생성일시, 생성자, 기간, 요약, 검증코드
- 검증코드 = SHA-256(data + system_secret) → 16자리 하이폰 구분
- export_logs INSERT (INSERT only 트리거)

verification API (재단담당자 전용):
- POST /verify: 검증코드 → export_logs 대조 → 원본확인/변경감지
- GET /export-logs: 기간 필터, 동일기간 반복 경고
- GET /adjustment-logs: 기간·직원·조정자 필터, 대량조정 경고

⚠️ 다른 Track 파일 수정 금지
```

**에이전트 3-I: 대결 + 스케줄러**
```
Track I: 대결 라우팅 + 스케줄러를 구현해 주세요.

파일 생성:
- server/services/delegateRouter.js
- server/services/scheduler.js

delegateRouter.js:
- routeToDelegate(step_id): 부재 확인 → 1순위 → 2순위 → 대기
- checkUrgencyAndRoute(request_id): 동적 전환시간 결정
  긴급(1일이내) 즉시 / 단기(2~3일) 8시간 / 일반(4일+) 24시간

scheduler.js (node-cron):
- */30 * * * * : 미처리 자동 대결 전환
  - 50% 경과 → unprocessed_warning 알림
  - 100% 경과 → routeToDelegate() 호출
- 0 0 * * * : 부재 복귀 예정일 자동 해제
  - is_absent=true AND absent_return_date < today → 해제
- 0 0 1 1 * : 연차 자동 계산 (연초)

⚠️ notificationService.notify() 호출로 알림 발송 (Track G에서 구현 완료)
⚠️ 다른 Track 파일 수정 금지
```

#### Phase 3 Gate Check
```
Phase 3 완료 확인:
□ 보고서 내보내기 → zip(엑셀+PDF) 다운로드
□ PDF 마지막 페이지 검증 정보 확인
□ 검증코드 검증 동작 (일치/불일치)
□ 내보내기 이력 조회 + 동일기간 경고
□ 조정 이력 조회 + 대량조정 경고
□ 부재 설정 → 대결자 전환 동작
□ 미처리 자동 전환 (시간 경과 시뮬레이션)
□ 부재 예정일 경과 → 자동 해제
→ 모두 확인 후 Phase 4 시작
```

#### Phase 4 — 통합 (단독, 1개 에이전트)

```
Phase 4: 전체 통합 + 캘린더 + 현황 + SEA 패키징을 수행해 주세요.

1. server/index.js에 모든 라우트 등록 (9개 도메인)
2. client/src/App.jsx에 모든 라우트 등록

3. 남은 기능 구현:
   - server/routes/calendar.js
     GET /team: 열람 범위 기반 필터링 (leave_request_visibility JOIN)
     GET /me: 내 캘린더
   - client/src/components/status/TeamCalendar.jsx (V-01)
   - client/src/components/status/TeamStatus.jsx (V-02)
   - client/src/components/status/FullStatus.jsx (V-03)
   - client/src/components/status/RegulationView.jsx (V-04)

4. Express 정적 파일 서빙: dist/client/ → SPA 폴백
5. DB 초기화 로직: 시작 시 schema.sql 실행 (테이블 없으면 생성)
6. 스케줄러 시작
7. 시작 메시지:
   "휴가관리 시스템이 시작되었습니다"
   "브라우저에서 접속: http://[IP]:3000"

8. SEA 패키징:
   - Vite 빌드 → dist/client/
   - esbuild 서버 번들링 (better-sqlite3 native 모듈 주의)
   - Node.js SEA → .exe

9. 통합 테스트 (작업 지시서 §7 시나리오 1~6)
```

### 9.4 에이전트 간 인터페이스 규약

**알림 발송 (Track E, I → Track G)**
```javascript
// Track E, I에서 알림이 필요한 곳에서 이렇게 호출:
const { notify } = require('../services/notificationService');
await notify(employeeId, 'approval_request', {
  name: '김직원',
  type: '연차',
  id: requestId
});
// notificationService가 아직 없으면 빈 함수로 스텁 처리
```

**연차 계산 (Track D, E → Track B)**
```javascript
// 직원 등록(Track D), 신청(Track E)에서 이렇게 호출:
const { calculateAnnualLeave } = require('../services/leaveCalculator');
const result = calculateAnnualLeave(hireDate, year);
// leaveCalculator가 아직 없으면 고정값 반환 스텁 처리
```

**스텁 처리 원칙**: 의존하는 서비스가 아직 구현되지 않았으면, 해당 import를 try-catch로 감싸거나 빈 함수 스텁을 만들어서 에러 없이 동작하게 한다. Phase Gate에서 통합 확인 시 실제 서비스로 교체.

### 9.5 충돌 방지 규칙

1. **server/index.js**: Phase 0에서 뼈대 생성, Phase 4에서 최종 통합. 중간 Phase에서 수정 금지
2. **client/src/App.jsx**: Track C에서 라우트 구조 생성 (대상 컴포넌트는 플레이스홀더). Phase 4에서 실제 컴포넌트로 교체
3. **package.json**: Phase 0에서만 수정. 추가 패키지 필요 시 Phase Gate에서 일괄 추가
4. **DB 스키마**: Phase 0에서 전체 생성. 이후 수정 금지
5. **공통 컴포넌트 (common/*)**: Track C가 소유. 다른 Track에서는 import만 하고 수정하지 않음

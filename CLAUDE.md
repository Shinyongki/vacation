# CLAUDE.md — 휴가관리 시스템

> Claude Code가 이 프로젝트에서 작업할 때 자동으로 읽는 파일.
> 모든 에이전트는 작업 시작 전 이 파일을 먼저 참조할 것.

## 프로젝트 한 줄 요약

재단법인 경상남도사회서비스원 산하 시설 납품용 **로컬 전용 휴가관리 시스템**.
React + Node.js + Express + SQLite. Node.js SEA → .exe 단일 실행파일.

## 기술 스택

| 구분 | 기술 | 비고 |
|------|------|------|
| Frontend | React 18+ | Vite 번들러, **JavaScript** (TypeScript 아님) |
| Backend | Node.js + Express | REST API (JSON), **JavaScript** |
| DB | SQLite | better-sqlite3 (동기식, WAL 모드) |
| Auth | JWT | jsonwebtoken + bcryptjs |
| Excel | exceljs | 읽기 + 쓰기 |
| PDF | pdfkit | 보고서 생성 |
| ZIP | archiver | 엑셀+PDF 묶음 |
| Scheduler | node-cron | 자동 대결, 부재 해제 |
| Packaging | Node.js SEA | .exe 단일 실행파일 |

**사용하지 않는 것:** TypeScript, Drizzle ORM, Tailwind CSS, shadcn/ui, Zustand, CDN 폰트/라이브러리 (인터넷 없음)

## 핵심 수치

- DB 테이블: **18개**
- API: **58개** (9개 도메인)
- 화면: **37개** (모달 7개)
- 사용자 역할: **5개** (staff, team_lead, director, hr_admin, foundation)
- 휴가 유형: **7가지**
- 신청 상태: **6개** (draft, pending, approved, rejected, recalled, cancelled)
- 직원 등록 필드: **11개**
- 알림 유형: **9가지** + 브라우저 알림(Web Notification API)

## 참조 문서 (docs/ 디렉토리)

상세 스펙이 필요할 때 아래 경로의 문서를 열어서 참조할 것.

| 문서 | 경로 | 참조 시점 |
|------|------|----------|
| **작업 지시서 v2.0** | `docs/work-instruction-v2.md` | ⭐ DB 스키마 전문(§1), API 스펙(§2), 에이전트 프롬프트(§9.3) |
| **PRD v1.2** | `docs/prd-v1.2.md` | 기능 요구사항 75개, 비즈니스 규칙 36개 |
| **IA v1.2** | `docs/ia-v1.2.md` | 37개 화면 목록, 정보 요소, 접근 제어 매트릭스 |
| **Use Case v1.2** | `docs/usecase-v1.2.md` | 43개 Use Case 상세 흐름 |
| **디자인 가이드 v1.0** | `docs/design-guide-v1.0.md` | 색상 팔레트, 폰트, 컴포넌트 규격, 레이아웃 |
| **데이터 무결성 검증 가이드** | `docs/data-integrity-guide.md` | 검증코드·해시·Audit Trail |

## 디렉토리 구조

```
/leave-management
├── server/
│   ├── index.js                    # Express 앱 + 라우트 등록
│   ├── database/
│   │   ├── connection.js           # better-sqlite3 싱글턴 (WAL, foreign_keys ON)
│   │   ├── schema.sql              # 18개 테이블 DDL
│   │   └── seed.sql                # 초기 데이터
│   ├── middleware/
│   │   ├── auth.js                 # JWT 검증 → req.user
│   │   ├── rbac.js                 # requireRole(...roles)
│   │   └── errorHandler.js
│   ├── routes/                     # 9개 도메인
│   │   ├── auth.js                 # /api/auth (5)
│   │   ├── leaves.js               # /api/leaves (7) ← recall, redraft 포함
│   │   ├── balances.js             # /api/balances (3)
│   │   ├── approvals.js            # /api/approvals (5)
│   │   ├── dashboard.js            # /api/dashboard (5)
│   │   ├── notifications.js        # /api/notifications (3)
│   │   ├── calendar.js             # /api/calendar (2)
│   │   ├── admin.js                # /api/admin (22)
│   │   ├── reports.js              # /api/reports (3)
│   │   └── verification.js         # /api/verification (3)
│   ├── services/
│   │   ├── approvalEngine.js       # 결재 라인 생성, 순차 승인/반려
│   │   ├── leaveCalculator.js      # 연차 자동 계산 (BR-01)
│   │   ├── notificationService.js  # 알림 9가지 + 브라우저 알림 지원
│   │   ├── delegateRouter.js       # 대결 라우팅 (1순위→2순위)
│   │   ├── reportGenerator.js      # exceljs + pdfkit → zip
│   │   ├── verificationService.js  # SHA-256 검증코드
│   │   └── scheduler.js            # node-cron (대결전환, 부재해제, 연차계산)
│   └── utils/
│       ├── dateUtils.js            # 근속연수, 영업일, 날짜 차이
│       └── holidays.js             # 공휴일·자체휴일 조회
├── client/
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx                 # 전체 라우팅
│   │   ├── api/client.js           # axios + JWT 인터셉터
│   │   ├── contexts/               # AuthContext, NotificationContext
│   │   ├── hooks/                  # useAuth, useApi
│   │   ├── styles/global.css       # 디자인 가이드 기반 CSS 변수
│   │   └── components/
│   │       ├── auth/               # LoginPage, PasswordChangeModal, ProtectedRoute
│   │       ├── common/             # Sidebar, Modal, DataTable, Badge, Calendar, ...
│   │       ├── dashboard/          # 5종 역할별 대시보드
│   │       ├── leave/              # LeaveForm(L-03), LeaveList(L-01), LeaveDetail(L-02)
│   │       ├── approval/           # ApprovalList(A-01), RejectModal(A-03), BatchApprove(A-04)
│   │       ├── admin/              # AdminSettings 7탭 + ExcelUploadModal
│   │       ├── report/             # ReportView(R-01,R-02)
│   │       ├── verification/       # VerificationView(X-01~03)
│   │       └── status/             # TeamCalendar(V-01), TeamStatus(V-02), FullStatus(V-03)
│   └── index.html
├── scripts/
│   └── build-sea.js
├── CLAUDE.md                       # 이 파일
├── package.json
└── vite.config.js
```

## 코딩 규칙

### 백엔드
- better-sqlite3 **동기식** API 사용 (async 불필요)
- 모든 API 응답: `{ success: true, data: ... }` 또는 `{ success: false, error: ... }`
- 결재 승인 + 잔여일수 차감 → 반드시 **db.transaction()** 으로 원자적 처리
- **INSERT only 테이블**: approval_steps(완료 건), balance_adjustments, export_logs → UPDATE/DELETE 트리거 차단
- SQL 파라미터 바인딩 필수 (인젝션 방지)
- 날짜: `YYYY-MM-DD`, 시각: `YYYY-MM-DD HH:mm:ss`

### 프론트엔드
- 시스템 폰트: `font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Malgun Gothic", sans-serif`
- 색상은 **디자인 가이드 v1.0** 정의값만 사용 (CSS 변수 권장)
- 핵심 레이아웃:
  - 상단 헤더: 44px, 네이비 `#1B3A5C`
  - 경로 바: 28px, `#EEF1F5`
  - 사이드바: 192px, `#F6F7F9`, 아코디언 그룹 메뉴
  - 콘텐츠: 나머지, 패딩 20px 24px, 배경 `#F9FAFB`
- 카드: 0.5px 보더 `#DDE1E7`, 8px 라운드, 그림자 없음
- 배지: pill (border-radius: 999px)
- 이모지 사용 금지 (가이드 카드 📌, 열람/결재 시각 👁✍ 세 곳만 예외)
- **CDN 사용 금지** — 인터넷 없는 환경

### 공통
- 에러 메시지: 한글 (사용자 대면)
- 로그: 영문 (서버)
- 아이콘: lucide-react

## 오케스트라 병렬 코딩 규칙

이 프로젝트는 **멀티 에이전트 병렬 코딩(오케스트라)** 으로 개발합니다.

### 실행 순서
```
Phase 0 (단독) → Phase 1 (4병렬) → Phase 2 (3병렬) → Phase 3 (2병렬) → Phase 4 (단독)
```

### 트랙 구성
| Phase | Track | 담당 |
|:-----:|:-----:|------|
| 0 | — | 프로젝트 초기화, DB 스키마 18개, 공통 미들웨어 |
| 1 | A | 인증 + 사용자 관리 (5 API) |
| 1 | B | 연차 계산 엔진 (3 API) |
| 1 | C | 프론트엔드 쉘 + 공통 컴포넌트 |
| 1 | D | 관리자 CRUD (22 API) |
| 2 | E | ⭐ 휴가 신청 + 결재 + 회수/재기안/재상신 (12 API) |
| 2 | F | 대시보드 5종 (5 API) |
| 2 | G | 알림 9가지 + 브라우저 알림 (3 API) |
| 3 | H | 보고서 + 데이터 검증 (6 API) |
| 3 | I | 대결 + 부재 + 스케줄러 |
| 4 | — | 통합, 캘린더, 현황, SEA 패키징 |

### 핵심 규칙

1. **자기 소유 파일만 생성/수정** — 작업 지시서 v2.0 §9.2 파일 소유권 매트릭스 참조
2. **공유 파일 수정 금지** — `server/index.js`, `App.jsx`는 Phase 0과 4에서만 수정
3. **DB 스키마 수정 금지** — Phase 0에서 확정된 18개 테이블 그대로
4. **의존 서비스 스텁 처리** — 아직 구현되지 않은 서비스는 빈 함수로 대체
   ```javascript
   // 예: Track E에서 알림이 필요한데 Track G 미완성
   let notify;
   try { notify = require('../services/notificationService').notify; }
   catch { notify = () => {}; }
   ```
5. **Phase Gate** — 다음 Phase 전에 현재 Phase 전 Track 완료 확인

### 각 에이전트 실행 방법

작업 지시서 v2.0 §9.3에 **Phase별 복사-붙여넣기 프롬프트**가 있음. 해당 프롬프트를 에이전트에게 전달하면 됨.

## 주요 비즈니스 로직 요약

### 신청 검증
- **성별**: 남성 → 생리휴가·출산휴가 신청 불가 (leave_types.gender_restriction)
- **고용형태**: employment_type_leave_mapping에서 is_allowed=0인 유형 신청 불가
- **잔여일수**: 연차 차감 시 잔여 >= 차감
- **사후 신청**: 과거 날짜 + 6가지 사유 택1 + 연차·포상·생리 사후신청 불가
- **시간연차**: 점심(12~13시) 자동 제외, 8시간 = 1일

### 결재
- 순차 승인 (모든 단계 통과해야 최종 승인)
- **회수**: 기안자가 pending 건 직접 회수 → recalled → 재기안 가능
- **재상신**: rejected 건에서 데이터 복사 → 새 pending 건 (parent_request_id 연결)
- **취소 vs 회수**: 취소=종료(재기안 불가), 회수=수정 목적(재기안 가능)
- 결재 당시 직위·부서 스냅샷 필수

### 열람 범위
- 기안자가 신청 시 팀별 체크박스로 공개 범위 설정
- 승인 후 해당 팀 캘린더에만 이름+유형+기간 표시 (사유 비공개)
- 팀장·원장·HR은 권한으로 전체 열람 가능 (열람 범위와 별개)

### 데이터 무결성
- approval_steps, balance_adjustments, export_logs: INSERT only
- 퇴사자: status=inactive, resignation_date 기록, 데이터 보존, 로그인 차단

## 현재 상태

**개발 착수 가능**. 작업 지시서 v2.0 §9.3의 Phase 0 프롬프트부터 시작.

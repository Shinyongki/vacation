# CLAUDE.md — 휴가관리 시스템

> Claude Code가 이 프로젝트에서 작업할 때 자동으로 읽는 파일.
> 모든 에이전트는 작업 시작 전 이 파일을 먼저 참조할 것.
> v1.3 (2026.04.13 — 네이비 사이드바, Noto Sans KR, 보고서 5섹션, 알림 개선, UI 레이아웃 변경)

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
| Font | **Noto Sans KR** | @fontsource/noto-sans-kr (풀 버전 내장, 400+500) |
| Excel | exceljs | 읽기 + 쓰기 |
| PDF | pdfkit | 보고서 생성 (5섹션 구조) |
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
- 관리자 설정: **12개** 항목 (한글 라벨, 드롭다운/텍스트 혼합)
- 보고서 출력: **PDF + Excel (5개 섹션)**
  - 섹션 1: 표지 + 총괄 요약 (직원별 연차 현황)
  - 섹션 2: 사용 상세 (결재완료일, 최종승인자 포함)
  - 섹션 3: 결재 이력 상세 (건별 결재 단계, 대결/즉시처리 통계)
  - 섹션 4: 수동 조정 이력 (자동 경고 포함)
  - 섹션 5: 검증 정보 (검증 방법 안내 포함)
- 검증코드: 5개 섹션 전체 데이터 기반 HMAC-SHA256 해시

## 참조 문서 (docs/ 디렉토리)

상세 스펙이 필요할 때 아래 경로의 문서를 열어서 참조할 것.

| 문서 | 경로 | 참조 시점 |
|------|------|----------|
| **작업 지시서 v2.0** | `docs/work-instruction-v2.md` | ⭐ DB 스키마 전문(§1), API 스펙(§2), 에이전트 프롬프트(§9.3) |
| **PRD v1.3** | `docs/prd-v1.3.md` | 기능 요구사항 84개, 비즈니스 규칙 44개 |
| **IA v1.3** | `docs/ia-v1.3.md` | 37개 화면 목록, 정보 요소, 접근 제어 매트릭스 |
| **Use Case v1.3** | `docs/usecase-v1.3.md` | 43개 Use Case 상세 흐름 |
| **디자인 가이드 v1.2** | `docs/design-guide-v1.2.md` | 색상 팔레트, 폰트(Noto Sans KR), 컴포넌트 규격, 네이비 사이드바 |
| **데이터 무결성 검증 가이드** | `docs/data-integrity-guide.md` | 검증코드·해시·Audit Trail |

## 디렉토리 구조

```
/leave-management
├── server/
│   ├── index.js                    # Express 앱 + 라우트 등록
│   ├── database/
│   │   ├── connection.js           # better-sqlite3 싱글턴 (WAL, foreign_keys ON)
│   │   ├── schema.sql              # 18개 테이블 DDL
│   │   └── seed.sql                # 초기 데이터 + 데모 계정
│   ├── middleware/
│   │   ├── auth.js                 # JWT 검증 → req.user
│   │   ├── rbac.js                 # requireRole(...roles)
│   │   └── errorHandler.js
│   ├── routes/                     # 9개 도메인
│   │   ├── auth.js                 # /api/auth (5)
│   │   ├── leaves.js               # /api/leaves (7) ← recall, redraft 포함
│   │   ├── balances.js             # /api/balances (3)
│   │   ├── approvals.js            # /api/approvals (5)
│   │   ├── dashboard.js            # /api/dashboard (5) ← HR 바로가기 7개 포함
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
│   │   ├── reportGenerator.js      # exceljs + pdfkit → 5섹션 구조 → zip
│   │   ├── verificationService.js  # HMAC-SHA256 검증코드 (5섹션 전체 데이터)
│   │   └── scheduler.js            # node-cron (대결전환, 부재해제, 연차계산)
│   └── utils/
│       ├── dateUtils.js            # 근속연수, 영업일, 날짜 차이
│       └── holidays.js             # 공휴일·자체휴일 조회
├── client/
│   ├── src/
│   │   ├── main.jsx                # @fontsource/noto-sans-kr import
│   │   ├── App.jsx                 # 전체 라우팅
│   │   ├── api/client.js           # axios + JWT 인터셉터
│   │   ├── contexts/               # AuthContext, NotificationContext(브라우저 알림 개선)
│   │   ├── hooks/                  # useAuth, useApi
│   │   ├── styles/global.css       # 디자인 가이드 v1.2 기반 CSS 변수 + info-table 스타일
│   │   └── components/
│   │       ├── auth/               # LoginPage, PasswordChangeModal, ProtectedRoute
│   │       ├── common/             # Sidebar(네이비), Modal, DataTable, Badge, Calendar, ...
│   │       ├── dashboard/          # 5종 역할별 대시보드 (HRDashboard: 바로가기 7개)
│   │       ├── leave/              # LeaveForm(L-03), LeaveList(L-01), LeaveDetail(L-02: 2단 레이아웃)
│   │       ├── approval/           # ApprovalList(A-01), RejectModal(A-03), BatchApprove(A-04)
│   │       ├── admin/              # AdminSettings 7탭 (URL: /admin?tab=) + ExcelUploadModal
│   │       ├── report/             # ReportView(R-01,R-02)
│   │       ├── verification/       # VerificationView(X-01~03)
│   │       └── status/             # TeamCalendar(V-01), TeamStatus(V-02), FullStatus(V-03), RegulationView(V-04: 아코디언)
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
- 폰트: `font-family: "Noto Sans KR", -apple-system, BlinkMacSystemFont, "Segoe UI", "Malgun Gothic", sans-serif`
- 색상은 **디자인 가이드 v1.2** 정의값만 사용 (CSS 변수 권장)
- 핵심 레이아웃:
  - 상단 헤더: 44px, 네이비 `#1B3A5C`
  - 경로 바: 28px, `#EEF1F5`
  - **사이드바: 192px, 네이비 `#1B3A5C`** (카테고리 13px #93B3D1, 메뉴 15px #C8D8E8, 활성 #FFFFFF)
  - 콘텐츠: 나머지, 패딩 24px 28px, 배경 `#F9FAFB`
- 카드: 1px 보더 `#DDE1E7`, 8px 라운드, 그림자 없음
- 배지: pill (border-radius: 999px), **13px** 500
- 이모지 사용 금지 (가이드 카드 📌, 열람/결재 시각 👁✍ 세 곳만 예외)
- **CDN 사용 금지** — 인터넷 없는 환경

### 프론트엔드 컴포넌트 패턴 (v1.3 추가)
- **아코디언 컴포넌트**: `useState`로 열림/닫힘 상태 관리, `ChevronRight`/`ChevronDown` 아이콘, lucide-react 사용. 휴가 규정 페이지(V-04)에서 사용. 여러 항목 동시 펼침 가능 (독립 토글).
- **info-table**: 섹션 헤더(`info-table__section-head`, 배경 #F3F5F7) + 라벨/값 행 구조의 테이블 컴포넌트. 라벨 셀 배경 #FAFBFC, 값 셀 배경 #FFFFFF. LeaveDetail(L-02)에서 사용.
- **상세 페이지 2단 레이아웃**: `display: grid; gridTemplateColumns: 1fr 1fr; alignItems: stretch` — 좌측(결재 타임라인) + 우측(신청 정보). 좌우 높이 동일.
- **navigate(-1)**: LeaveDetail의 "목록으로" 버튼은 브라우저 뒤로가기. 승인대기/내 휴가 목록/대시보드 등 진입 경로에 따라 자동 복귀.

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

### 알림 시스템 (v1.3 보강)
- 브라우저 알림은 `requireInteraction: true`로 사용자 확인 전까지 유지
- 알림 클릭 또는 닫기 시 서버에 읽음 처리(PUT /notifications/:id/read) → 재표시 방지
- `dismissedIdsRef`로 세션 내 확인 완료된 알림 추적

### 보고서 검증 (v1.3 보강)
- 검증코드: 총괄요약 + 사용상세 + 결재이력 + 조정이력 전체 데이터를 JSON.stringify → HMAC-SHA256
- PDF/Excel 모두 동일 5섹션 구조
- 자동 경고: 보고 직전 대량 조정(7일내 5건+), 반복 조정(동일인 3회+), 사유 불명확
- 결재 이력: 즉시 처리(열람~결재 1분 이내) 건 표시, 대결 비율 통계

### 관리자 설정 URL 구조 (v1.3 변경)
- AdminSettings: `/admin?tab={탭키}` (useSearchParams 기반)
- 탭 키: employees | leaveTypes | approvalFlows | delegates | holidays | settings | balances
- HR 대시보드 바로가기 7개도 동일 경로 사용

## 현재 상태

**1차 개발 완료 + UI 점검·수정 중**. 네이비 사이드바, Noto Sans KR, 보고서 5섹션, 알림 개선, 휴가 규정 아코디언, 시스템설정 한글화 반영됨.

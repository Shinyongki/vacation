# 휴가관리 시스템 변경 이력 (2026.04.13 세션)

> 이 문서를 기반으로 아래 **6개 문서**를 수정해 주세요.
> 각 항목에 영향받는 문서를 명시했습니다.
>
> **수정 대상 문서 목록:**
> 1. `prd-v1.2.md` — 기능 요구사항, 비즈니스 규칙
> 2. `ia-v1.2.md` — 화면 목록, 정보 요소, 접근 제어 매트릭스
> 3. `usecase-v1.2.md` — Use Case 상세 흐름
> 4. `design-guide-v1.0.md` — 컴포넌트 규격, 레이아웃, 색상
> 5. `CLAUDE.md` (프로젝트 루트) — 아래 "CLAUDE.md 수정 사항" 섹션 참조
> 6. `work-instruction-v2.md` — 보고서 관련 API 스펙 변경 반영

---

## 1. 휴가 규정 페이지 — 아코디언 접기/펼치기 구조로 변경

**파일**: `client/src/components/status/RegulationView.jsx`

**변경 전**: 카드형 레이아웃으로 모든 휴가 유형(연차, 병가, 공가 등)이 펼쳐진 상태로 표시

**변경 후**:
- 8개 항목(연차휴가, 병가, 공가, 경조사휴가, 출산휴가, 생리휴가, 포상휴가, 공통 규정)을 **아코디언 리스트**로 구성
- 기본 상태: **모두 접힘**
- 클릭 시 해당 항목만 펼침 (ChevronRight → ChevronDown 아이콘 전환)
- 여러 항목을 동시에 펼칠 수 있음 (독립 토글)
- 접힌 상태에서도 제목 옆에 배지(유급/무급/여성 전용 등)가 보임

**영향 문서**: IA (화면 V-04 휴가규정 정보 요소 변경), Design Guide (아코디언 컴포넌트 규격 추가)

---

## 2. 브라우저 알림 — 사용자 확인 전까지 유지 + 확인 시 읽음 처리

**파일**: `client/src/contexts/NotificationContext.jsx`

**변경 전**:
- 브라우저 알림이 잠시 표시 후 자동 사라짐
- 알림 클릭/닫기 후에도 서버에서 미읽음 상태 유지 → 다음 폴링에서 반복 표시

**변경 후**:
- `requireInteraction: true` 적용 → 사용자가 직접 닫기 전까지 알림 유지
- **알림 클릭 시**: 서버에 읽음 처리(PUT /notifications/:id/read) + 해당 페이지로 이동
- **알림 닫기(X) 시**: 서버에 읽음 처리
- `dismissedIdsRef`로 확인 완료된 알림 ID 추적 → 폴링 시 재표시 방지

**영향 문서**: PRD (알림 비즈니스 규칙 보강), UseCase (UC-알림 수신 흐름 보강)

---

## 3. 휴가 신청 상세 — "목록으로" 버튼 브라우저 히스토리 기반으로 변경

**파일**: `client/src/components/leave/LeaveDetail.jsx`

**변경 전**: "목록으로" 버튼이 항상 `/leaves`(내 휴가 목록)로 하드코딩 이동

**변경 후**: `navigate(-1)` (브라우저 뒤로가기) 사용
- 승인대기에서 진입 → 승인대기로 복귀
- 내 휴가 목록에서 진입 → 내 휴가 목록으로 복귀
- 대시보드에서 진입 → 대시보드로 복귀
- 결재이력에서 진입 → 결재이력으로 복귀

**영향 문서**: UseCase (UC-휴가상세조회 흐름의 "목록으로" 동작 수정), IA (L-02 네비게이션 동작 수정)

---

## 4. 휴가 신청 상세 — 좌우 2단 레이아웃으로 변경

**파일**: `client/src/components/leave/LeaveDetail.jsx`, `client/src/styles/global.css`

**변경 전**: 위(신청정보 카드) → 아래(결재현황 카드) 세로 2단 구성

**변경 후**: CSS Grid `1fr 1fr` 좌우 2단 구성
- **왼쪽**: 결재 현황 카드 (타임라인)
  - 기안/검토/결재 단계 간 간격 3배 확대 (min-height 240px, line min-height 96px)
  - `flex: 1`로 카드 높이에 맞춰 타임라인이 균등 분배
- **오른쪽**: 신청 정보 + 열람 범위 + 연관 신청(원본/재기안)
  - 신청 정보 카드가 `flex: 1`로 왼쪽과 높이 맞춤
- `alignItems: 'stretch'`로 좌우 높이 동일

**영향 문서**: IA (L-02 화면 레이아웃 구조 변경), Design Guide (상세 페이지 2단 레이아웃 규격 추가)

---

## 5. 휴가 신청 상세 — 신청 정보 테이블 구조화

**파일**: `client/src/components/leave/LeaveDetail.jsx`, `client/src/styles/global.css`

**변경 전**: 2열 그리드에 라벨+값이 나열되는 단순 구조

**변경 후**: 섹션 헤더가 있는 가로 라벨-값 테이블 구조 (`info-table` 클래스)
- **신청자 정보** 섹션: 신청자, 소속, 신청일
- **휴가 정보** 섹션: 휴가 유형, 기간, 신청 일수(파란색 강조), 사유
- **추가 정보** 섹션 (조건부): 긴급 사유, 사후 신청 사유, 회수 사유
- 왼쪽 라벨 셀: 배경 #FAFBFC, 오른쪽 값 셀: 흰색
- 섹션 헤더: 배경 #F3F5F7, 볼드

**영향 문서**: IA (L-02 정보 요소 그룹핑 변경), Design Guide (info-table 컴포넌트 규격 추가)

---

## 6. 관리자 설정 > 시스템 설정 — 한글화 및 UX 개선

**파일**: `client/src/components/admin/SystemSettings.jsx`

**변경 전**:
- 설정 항목이 영어 키(예: `approval_line_structure`)로 표시
- 설명은 한글이지만 키 아래에 부속 텍스트로만 표시
- `true`/`false`, `own_team`/`all` 같은 영어 값을 직접 타이핑해야 함

**변경 후**:
- 영어 키 제거 → 한글 라벨로 대체 (예: "결재 라인 구조", "연차 자동 계산")
- 설명문을 더 쉬운 표현으로 개선 (예: "입사일 기준으로 연차를 자동 계산할지 여부입니다.")
- 입력창 placeholder도 한글 (예: "0 = 제한 없음", "시간 단위 (예: 24)")
- **연차 자동 계산**: 텍스트 입력 → 드롭다운 선택 ("사용" / "사용 안 함")
- **팀장 열람 범위**: 텍스트 입력 → 드롭다운 선택 ("소속 팀만" / "전체")

**SETTING_META 매핑 (12개 항목)**:

| 키 | 한글 라벨 | 입력 방식 |
|---|---|---|
| approval_line_structure | 결재 라인 구조 | 텍스트 |
| retroactive_reasons | 사후 신청 허용 사유 | 텍스트에어리어 |
| half_day_am_time | 오전 반차 시간 | 텍스트 |
| half_day_pm_time | 오후 반차 시간 | 텍스트 |
| concurrent_leave_limit | 동시 휴가 인원 제한 | 텍스트 |
| auto_annual_calc | 연차 자동 계산 | 드롭다운 (사용/사용 안 함) |
| team_lead_view_scope | 팀장 열람 범위 | 드롭다운 (소속 팀만/전체) |
| delegate_urgent_hours | 긴급 대결 전환 시간 | 텍스트 |
| delegate_short_hours | 단기 부재 대결 전환 시간 | 텍스트 |
| delegate_normal_hours | 일반 부재 대결 전환 시간 | 텍스트 |
| work_start_time | 근무 시작 시간 | 텍스트 |
| work_end_time | 근무 종료 시간 | 텍스트 |

**영향 문서**: IA (AD-06 시스템설정 화면 정보 요소 변경), PRD (시스템 설정 UI 요구사항), Design Guide (드롭다운 활용 규격)

---

## 7. HR관리자 대시보드 — 관리 메뉴 바로가기 수정

**파일**: `client/src/components/dashboard/HRDashboard.jsx`, `client/src/components/admin/AdminSettings.jsx`, `server/routes/dashboard.js`

**변경 전**:
- 바로가기 경로가 `/admin/employees` 등 존재하지 않는 라우트로 지정 → 클릭해도 화면 전환 없음
- "대결자 관리" 바로가기 누락 (관리자 설정 탭 7개 중 6개만 표시)

**변경 후**:
- `AdminSettings` 컴포넌트가 URL 쿼리 파라미터(`?tab=`) 기반으로 탭 전환
  - 예: `/admin?tab=employees` → 직원 관리 탭 활성화
  - 탭 클릭 시 URL도 함께 변경 (`useSearchParams`)
- 바로가기 경로를 `/admin?tab=employees` 형태로 수정
- **대결자 관리** 바로가기 추가 → 관리자 설정 탭 7개와 동일:

| 바로가기 | 경로 | 아이콘 |
|---|---|---|
| 직원 관리 | /admin?tab=employees | Users |
| 휴가 유형 | /admin?tab=leaveTypes | Calendar |
| 결재 라인 | /admin?tab=approvalFlows | GitBranch |
| 대결자 관리 | /admin?tab=delegates | UserCheck |
| 휴일 관리 | /admin?tab=holidays | CalendarDays |
| 시스템 설정 | /admin?tab=settings | Settings |
| 잔여일수 관리 | /admin?tab=balances | BarChart3 |

**영향 문서**: IA (D-04 HR대시보드 바로가기 구성 변경, AD-00 관리자설정 URL 구조 변경), UseCase (UC-관리자설정 진입 흐름 변경)

---

## 8. PDF/Excel 보고서 — 5개 섹션 구조로 전면 재설계

**파일**: `server/services/reportGenerator.js`

**변경 전**: PDF에 사용 내역 테이블 + 검증 정보만 존재. 엑셀도 3시트(사용현황, 직원별요약, 검증정보).

**변경 후**: PDF와 엑셀 모두 5개 섹션/시트로 확장

### 섹션 1: 표지 + 총괄 요약
- **표지**: 제목 24px bold 가운데, 부제 "재단법인 경상남도사회서비스원", 기간, 생성자/일시
- **요약 수치 박스**: 총 직원 수, 총 사용 건수, 총 사용 일수
- **총괄 요약 테이블** (핵심):
  - 컬럼: 사번, 이름, 부서, 입사일, 근속연수, 발생일수, 사용일수, 조정일수, 잔여일수, 소진율(%)
  - 잔여일수 음수 → 빨간색 행
  - 조정일수 != 0 → 볼드
  - 하단 합계 행

### 섹션 2: 사용 상세 (기존 보강)
- 기존 8컬럼 + **결재완료일**, **최종승인자** 2컬럼 추가
- 대결 처리 건: 최종승인자 옆에 "(대결)"
- 사후 신청 건: 유형 옆에 "[사후]"
- 긴급 건: 유형 옆에 "[긴급]"
- 결재중(pending) 건: 결재완료일에 "결재중" 빨간색

### 섹션 3: 결재 이력 상세 (신규)
- **건별 그룹핑**: 헤더 행(신청번호, 신청자, 유형, 기간, 일수) + 단계별 상세 행
- 단계별: 단계, 유형(기안/협조/검토/결재), 결재자, 열람시각, 결재시각, 결과, 대결여부
- 대결 시 "대결 (원래: OOO)" 표시
- 열람~결재 1분 이내 건: 결재시각에 "*" 표시 (형식적 결재 의심)
- **하단 통계**: 대결 처리 비율, 즉시 승인(1분 이내) 비율

### 섹션 4: 수동 조정 이력 (신규)
- 컬럼: 조정일시, 대상직원(사번+이름), 조정자(사번+이름), 조정 전, 조정량, 조정 후, 사유
- **자동 경고** (테이블 하단, 빨간색):
  - 보고서 생성일 기준 7일 이내 5건 이상: "보고 직전 대량 조정 감지: N건"
  - 동일 직원 3회 이상 반복 조정: "반복 조정 대상: OOO (N회)"
  - 사유 불명확(기타/조정/수정/2글자 이하): "사유 불명확: N건"
- 조정 건 없을 시: "해당 기간 내 수동 조정 내역이 없습니다."

### 섹션 5: 검증 정보 (기존 보강)
- 기존 항목 + **총 조정 건수** 추가
- 검증코드: 5개 섹션 전체 데이터를 JSON.stringify 후 SHA-256 해시
- **검증 방법 안내** 텍스트 박스 추가:
  "시설 방문 시 재단담당자 계정으로 로그인하여 데이터 검증 → 보고서 검증 메뉴에서 위 검증코드를 입력하면 원본 여부를 확인할 수 있습니다."

### PDF 스타일
- 헤더 배경: #1B3A5C (네이비), 테이블 헤더: #F3F5F7, 경고: #DC2626
- A4 세로, 여백 40pt, 섹션마다 새 페이지
- 페이지 하단: "- N -" 페이지 번호

### 엑셀 5시트
- Sheet 1: 총괄 요약 (동일 컬럼)
- Sheet 2: 사용 상세 (동일 컬럼)
- Sheet 3: 결재 이력 (건별 그룹 헤더 + 단계 행 + 통계)
- Sheet 4: 조정 이력 (동일 컬럼 + 경고)
- Sheet 5: 검증 정보

### 검증코드 계산 범위 변경
- 기존: 사용 상세 데이터만으로 해시 계산
- 변경: 총괄요약 + 사용상세 + 결재이력 + 조정이력 4개 데이터셋을 JSON.stringify 후 해시

**영향 문서**: PRD (보고서 기능 요구사항 대폭 확장), IA (R-01/R-02 보고서 출력 구성 변경), UseCase (UC-보고서생성, UC-보고서검증 흐름 확장), Design Guide (보고서 PDF 스타일 규격 추가)

---

## 변경 파일 목록

| 파일 | 변경 유형 |
|---|---|
| `client/src/components/status/RegulationView.jsx` | 전면 재작성 (아코디언) |
| `client/src/contexts/NotificationContext.jsx` | 브라우저 알림 개선 |
| `client/src/components/leave/LeaveDetail.jsx` | 레이아웃 재구성 + 네비게이션 수정 |
| `client/src/styles/global.css` | info-table, approval-timeline 스타일 추가/수정 |
| `client/src/components/admin/SystemSettings.jsx` | 한글화 + 드롭다운 |
| `client/src/components/admin/AdminSettings.jsx` | URL 쿼리 파라미터 탭 전환 |
| `client/src/components/dashboard/HRDashboard.jsx` | 아이콘 맵 확장 |
| `client/src/components/approval/ApprovalList.jsx` | from state 전달 (현재 미사용, navigate(-1)로 대체됨) |
| `client/src/components/approval/ApprovalHistory.jsx` | from state 전달 (현재 미사용) |
| `server/routes/dashboard.js` | 바로가기 경로 + 대결자관리 추가 |
| `server/services/reportGenerator.js` | 전면 재작성 (5섹션 PDF/Excel) |

---

## CLAUDE.md 수정 사항

`CLAUDE.md`는 프로젝트 루트(`/leave-management/CLAUDE.md`)에 있으며, 아래 내용을 반영해야 합니다.

### 1. 프론트엔드 컴포넌트 패턴 추가

현재 CLAUDE.md의 "프론트엔드" 코딩 규칙 섹션에 아래 내용 추가:

- **아코디언 컴포넌트**: `useState`로 열림/닫힘 상태 관리, `ChevronRight`/`ChevronDown` 아이콘, lucide-react 사용
- **info-table**: 섹션 헤더(`info-table__section-head`) + 라벨/값 행 구조의 테이블 컴포넌트 (LeaveDetail에서 사용)
- **상세 페이지 2단 레이아웃**: `display: grid; gridTemplateColumns: 1fr 1fr; alignItems: stretch` — 좌우 높이 동일

### 2. 관리자 설정 URL 구조 변경

현재 디렉토리 구조 설명에서:
```
├── admin/              # AdminSettings 7탭 + ExcelUploadModal
```

아래 내용 보강:
```
├── admin/              # AdminSettings 7탭 (URL: /admin?tab=employees|leaveTypes|approvalFlows|delegates|holidays|settings|balances)
```

### 3. 알림 시스템 동작 보강

현재: "알림 9가지 + 브라우저 알림(Web Notification API)"

추가:
- 브라우저 알림은 `requireInteraction: true`로 사용자 확인 전까지 유지
- 알림 클릭 또는 닫기 시 서버에 읽음 처리(PUT /notifications/:id/read) → 재표시 방지
- `dismissedIdsRef`로 세션 내 확인 완료된 알림 추적

### 4. 보고서 구조 변경

현재 핵심 수치 섹션의 "API: 58개" 근처에 보고서 관련 설명 보강:

```
보고서 출력: PDF + Excel (5개 섹션)
  - 섹션 1: 표지 + 총괄 요약 (직원별 연차 현황)
  - 섹션 2: 사용 상세 (결재완료일, 최종승인자 포함)
  - 섹션 3: 결재 이력 상세 (건별 결재 단계, 대결/즉시처리 통계)
  - 섹션 4: 수동 조정 이력 (자동 경고 포함)
  - 섹션 5: 검증 정보 (검증 방법 안내 포함)
검증코드: 5개 섹션 전체 데이터 기반 SHA-256 해시
```

### 5. 주요 비즈니스 로직 요약에 추가

"데이터 무결성" 항목에 보고서 검증 관련 추가:

```
### 보고서 검증
- 검증코드: 총괄요약 + 사용상세 + 결재이력 + 조정이력 전체 데이터를 JSON.stringify → HMAC-SHA256
- PDF/Excel 모두 동일 5섹션 구조
- 자동 경고: 보고 직전 대량 조정(7일내 5건+), 반복 조정(동일인 3회+), 사유 불명확
- 결재 이력: 즉시 처리(열람~결재 1분 이내) 건 표시, 대결 비율 통계
```

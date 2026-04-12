-- 휴가관리 시스템 초기 데이터 (seed)

-- ============================================================
-- 1. 부서 3개
-- ============================================================
INSERT INTO departments (id, name, parent_id) VALUES
  (1, '경영지원팀', NULL),
  (2, '사업운영팀', NULL),
  (3, '돌봄서비스팀', NULL);

-- ============================================================
-- 2. 휴가 유형 7가지
-- ============================================================
INSERT INTO leave_types (id, name, code, default_days, requires_attachment, allows_retroactive, gender_restriction) VALUES
  (1, '연차', 'ANNUAL', NULL, 0, 0, NULL),
  (2, '병가', 'SICK', 60, 1, 1, NULL),
  (3, '경조사', 'CONDOLENCE', NULL, 1, 1, NULL),
  (4, '공가', 'PUBLIC', NULL, 1, 1, NULL),
  (5, '출산휴가', 'MATERNITY', 90, 1, 1, 'F'),
  (6, '생리휴가', 'MENSTRUAL', 1, 0, 0, 'F'),
  (7, '포상휴가', 'REWARD', NULL, 0, 0, NULL);

-- ============================================================
-- 3. 경조사 세부유형 8가지 (2025.3.27 개정)
-- ============================================================
INSERT INTO condolence_subtypes (id, leave_type_id, name, days, description) VALUES
  (1, 3, '본인 결혼', 5, NULL),
  (2, 3, '자녀 결혼', 1, NULL),
  (3, 3, '배우자 출산', 20, '분할 사용 가능 (3회)'),
  (4, 3, '부모 사망', 5, '배우자 부모 포함'),
  (5, 3, '배우자 사망', 5, NULL),
  (6, 3, '자녀 사망', 5, NULL),
  (7, 3, '조부모/외조부모 사망', 3, '배우자 조부모 포함'),
  (8, 3, '형제자매 사망', 3, '배우자 형제자매 포함');

-- ============================================================
-- 4. 데모 계정 5명 (초기 비밀번호: 생년월일 YYMMDD → bcrypt 해시)
--    모든 계정 비밀번호: 000101 → $2a$10$ 해시
-- ============================================================
-- password: 000101 (모든 데모 계정 동일, 초기 비밀번호 변경 필요)
INSERT INTO employees (id, employee_number, name, password_hash, role, department_id, hire_date, birth_date, gender, position, position_rank, phone, employment_type, status, is_initial_password) VALUES
  (1, '2024001', '김직원', '$2a$10$UAoVSol4jQB9u18347KdXu3cofzCiqKRlJ3f97OQ3kePlxSlgxU8C', 'staff', 1, '2024-03-01', '2000-01-01', 'M', '사원', 1, '010-1234-0001', 'regular', 'active', 0),
  (2, '2023001', '이팀장', '$2a$10$UAoVSol4jQB9u18347KdXu3cofzCiqKRlJ3f97OQ3kePlxSlgxU8C', 'team_lead', 1, '2023-01-02', '1985-05-15', 'M', '팀장', 3, '010-1234-0002', 'regular', 'active', 0),
  (3, '2020001', '박원장', '$2a$10$UAoVSol4jQB9u18347KdXu3cofzCiqKRlJ3f97OQ3kePlxSlgxU8C', 'director', 1, '2020-03-01', '1975-08-20', 'M', '원장', 5, '010-1234-0003', 'regular', 'active', 0),
  (4, '2022001', '최관리', '$2a$10$UAoVSol4jQB9u18347KdXu3cofzCiqKRlJ3f97OQ3kePlxSlgxU8C', 'hr_admin', 1, '2022-06-01', '1990-03-10', 'F', '주임', 2, '010-1234-0004', 'regular', 'active', 0),
  (5, '2021001', '정재단', '$2a$10$UAoVSol4jQB9u18347KdXu3cofzCiqKRlJ3f97OQ3kePlxSlgxU8C', 'foundation', 2, '2021-01-15', '1980-11-25', 'M', '담당자', 2, '010-1234-0005', 'regular', 'active', 0);

-- ============================================================
-- 5. 2026년 연차 잔여일수 (데모)
-- ============================================================
INSERT INTO leave_balances (employee_id, year, total_days, used_days, adjusted_days, calc_detail) VALUES
  (1, 2026, 11, 0, 0, '{"hire_date":"2024-03-01","years_of_service":1,"months":23,"formula":"1년 이상 15일 기준, 근속 2년 → 11일 (월할 계산)"}'),
  (2, 2026, 15, 0, 0, '{"hire_date":"2023-01-02","years_of_service":3,"formula":"1년 이상 15일"}'),
  (3, 2026, 18, 0, 0, '{"hire_date":"2020-03-01","years_of_service":5,"formula":"15일 + 2년마다 1일 추가 = 18일"}'),
  (4, 2026, 16, 0, 0, '{"hire_date":"2022-06-01","years_of_service":3,"formula":"15일 + 2년마다 1일 추가 = 16일"}');

-- ============================================================
-- 6. 기본 결재 라인 (기안→검토→결재)
-- ============================================================
INSERT INTO approval_flows (id, name, description) VALUES
  (1, '일반 결재', '기안 → 팀장 검토 → 원장 결재'),
  (2, '팀장 결재', '기안 → 원장 결재');

INSERT INTO approval_flow_steps (flow_id, step_order, step_type, assignee_type, assignee_position) VALUES
  (1, 1, 'draft', 'self', NULL),
  (1, 2, 'review', 'role', '팀장'),
  (1, 3, 'approval', 'role', '원장'),
  (2, 1, 'draft', 'self', NULL),
  (2, 2, 'approval', 'role', '원장');

-- 휴가유형별 결재 라인 매핑 (모든 유형 → 일반 결재)
INSERT INTO leave_type_flow_mapping (leave_type_id, approval_flow_id) VALUES
  (1, 1), (2, 1), (3, 1), (4, 1), (5, 1), (6, 1), (7, 1);

-- ============================================================
-- 7. 시스템 설정 12개
-- ============================================================
INSERT INTO system_settings (key, value, description) VALUES
  ('approval_line_structure', '기안→검토→결재', '기본 승인 라인 구조'),
  ('retroactive_reasons', '["긴급 업무","출장 중","시스템 장애","건강 사유","천재지변","기타 불가피한 사유"]', '사후 신청 허용 사유 목록'),
  ('half_day_am_time', '09:00-14:00', '오전 반차 시간'),
  ('half_day_pm_time', '14:00-18:00', '오후 반차 시간'),
  ('concurrent_leave_limit', '0', '동시 휴가 인원 제한 (0=제한 없음)'),
  ('auto_annual_calc', 'true', '연차 자동 계산 활성화'),
  ('team_lead_view_scope', 'own_team', '팀장 열람 범위 (own_team / all)'),
  ('delegate_urgent_hours', '0', '긴급 대결 전환 시간 (0=즉시)'),
  ('delegate_short_hours', '8', '단기 부재 대결 전환 시간'),
  ('delegate_normal_hours', '24', '일반 부재 대결 전환 시간'),
  ('work_start_time', '09:00', '근무 시작 시간'),
  ('work_end_time', '18:00', '근무 종료 시간');

-- ============================================================
-- 8. 2026년 공휴일 15개
-- ============================================================
INSERT INTO holidays (date, name, is_custom, year) VALUES
  ('2026-01-01', '신정', 0, 2026),
  ('2026-02-16', '설날 전날', 0, 2026),
  ('2026-02-17', '설날', 0, 2026),
  ('2026-02-18', '설날 다음날', 0, 2026),
  ('2026-03-01', '삼일절', 0, 2026),
  ('2026-05-05', '어린이날', 0, 2026),
  ('2026-05-24', '부처님오신날', 0, 2026),
  ('2026-06-06', '현충일', 0, 2026),
  ('2026-08-15', '광복절', 0, 2026),
  ('2026-09-24', '추석 전날', 0, 2026),
  ('2026-09-25', '추석', 0, 2026),
  ('2026-09-26', '추석 다음날', 0, 2026),
  ('2026-10-03', '개천절', 0, 2026),
  ('2026-10-09', '한글날', 0, 2026),
  ('2026-12-25', '크리스마스', 0, 2026);

-- ============================================================
-- 9. 고용형태별 휴가 매핑
-- ============================================================
-- 정규직: 7가지 전부 허용
INSERT INTO employment_type_leave_mapping (employment_type, leave_type_id, is_allowed) VALUES
  ('regular', 1, 1), ('regular', 2, 1), ('regular', 3, 1), ('regular', 4, 1),
  ('regular', 5, 1), ('regular', 6, 1), ('regular', 7, 1);

-- 계약직: 연차, 병가, 출산, 생리만 허용
INSERT INTO employment_type_leave_mapping (employment_type, leave_type_id, is_allowed) VALUES
  ('contract', 1, 1), ('contract', 2, 1), ('contract', 3, 0), ('contract', 4, 0),
  ('contract', 5, 1), ('contract', 6, 1), ('contract', 7, 0);

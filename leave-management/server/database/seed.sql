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
-- 4. 직원 10명 (기존 5명 + 추가 5명)
-- ============================================================
-- password_hash는 placeholder — connection.js seedDemoPasswords()에서 생년월일 기반으로 재설정됨
INSERT INTO employees (id, employee_number, name, password_hash, role, department_id, hire_date, birth_date, gender, position, position_rank, phone, employment_type, status, is_initial_password) VALUES
  (1,  '2024001', '김직원', '$2a$10$placeholder', 'staff',      1, '2024-03-01', '2000-01-01', 'M', '사원', 1, '010-1234-0001', 'regular',  'active', 0),
  (2,  '2023001', '이팀장', '$2a$10$placeholder', 'team_lead',  1, '2023-01-02', '1985-05-15', 'M', '팀장', 4, '010-1234-0002', 'regular',  'active', 0),
  (3,  '2020001', '박원장', '$2a$10$placeholder', 'director',   1, '2020-03-01', '1975-08-20', 'M', '원장', 5, '010-1234-0003', 'regular',  'active', 0),
  (4,  '2022001', '최관리', '$2a$10$placeholder', 'hr_admin',   1, '2022-06-01', '1990-03-10', 'F', '주임', 2, '010-1234-0004', 'regular',  'active', 0),
  (5,  '2021001', '정재단', '$2a$10$placeholder', 'foundation', 2, '2021-01-15', '1980-11-25', 'M', '담당자', 2, '010-1234-0005', 'regular',  'active', 0),
  (6,  '2024002', '박사원', '$2a$10$placeholder', 'staff',      1, '2024-03-01', '1998-07-15', 'M', '사원', 1, '010-1234-0006', 'regular',  'active', 0),
  (7,  '2024003', '한미영', '$2a$10$placeholder', 'staff',      1, '2023-06-15', '1995-04-22', 'F', '주임', 2, '010-1234-0007', 'regular',  'active', 0),
  (8,  '2023002', '송대리', '$2a$10$placeholder', 'staff',      3, '2021-09-01', '1993-11-08', 'M', '대리', 3, '010-1234-0008', 'regular',  'active', 0),
  (9,  '2023003', '윤주임', '$2a$10$placeholder', 'staff',      3, '2022-01-10', '1996-06-30', 'F', '주임', 2, '010-1234-0009', 'contract', 'active', 0),
  (10, '2022002', '강과장', '$2a$10$placeholder', 'team_lead',  3, '2019-03-01', '1988-12-05', 'M', '과장', 4, '010-1234-0010', 'regular',  'active', 0);

-- ============================================================
-- 5. 기본 결재 라인
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

INSERT INTO leave_type_flow_mapping (leave_type_id, approval_flow_id) VALUES
  (1, 1), (2, 1), (3, 1), (4, 1), (5, 1), (6, 1), (7, 1);

-- ============================================================
-- 6. 시스템 설정 12개
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
-- 7. 2026년 공휴일 15개
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
-- 8. 고용형태별 휴가 매핑
-- ============================================================
INSERT INTO employment_type_leave_mapping (employment_type, leave_type_id, is_allowed) VALUES
  ('regular', 1, 1), ('regular', 2, 1), ('regular', 3, 1), ('regular', 4, 1),
  ('regular', 5, 1), ('regular', 6, 1), ('regular', 7, 1);

INSERT INTO employment_type_leave_mapping (employment_type, leave_type_id, is_allowed) VALUES
  ('contract', 1, 1), ('contract', 2, 1), ('contract', 3, 0), ('contract', 4, 0),
  ('contract', 5, 1), ('contract', 6, 1), ('contract', 7, 0);

-- ============================================================
-- 9. 2026년 연차 잔여일수 (approved 건 반영)
-- ============================================================
INSERT INTO leave_balances (employee_id, year, total_days, used_days, adjusted_days, calc_detail) VALUES
  (1,  2026, 11, 2, 0, '{"hire_date":"2024-03-01","years_of_service":1,"formula":"월할 계산 11일"}'),
  (2,  2026, 15, 0, 0, '{"hire_date":"2023-01-02","years_of_service":3,"formula":"1년 이상 15일"}'),
  (3,  2026, 18, 0, 0, '{"hire_date":"2020-03-01","years_of_service":5,"formula":"15일 + 2년마다 1일 추가 = 18일"}'),
  (4,  2026, 16, 0, 0, '{"hire_date":"2022-06-01","years_of_service":3,"formula":"15일 + 2년마다 1일 추가 = 16일"}'),
  (6,  2026, 11, 1, 0, '{"hire_date":"2024-03-01","years_of_service":1,"formula":"월할 계산 11일"}'),
  (7,  2026, 15, 0, 0, '{"hire_date":"2023-06-15","years_of_service":2,"formula":"1년 이상 15일"}'),
  (8,  2026, 16, 3, 0, '{"hire_date":"2021-09-01","years_of_service":4,"formula":"15일 + 2년마다 1일 추가 = 16일"}'),
  (9,  2026, 15, 1, 0, '{"hire_date":"2022-01-10","years_of_service":4,"formula":"1년 이상 15일"}'),
  (10, 2026, 18, 2, 0, '{"hire_date":"2019-03-01","years_of_service":7,"formula":"15일 + 2년마다 1일 추가 = 18일"}');

-- ============================================================
-- 10. 휴가 신청 15건
-- ============================================================

-- === 승인 완료 5건 ===
INSERT INTO leave_requests (id, employee_id, leave_type_id, start_date, end_date, total_days, reason, status, created_at) VALUES
  (1, 1, 1, '2026-03-10', '2026-03-11', 2, '개인 사유', 'approved', '2026-03-05 09:00:00');
INSERT INTO leave_requests (id, employee_id, leave_type_id, start_date, end_date, total_days, reason, status, created_at) VALUES
  (2, 6, 1, '2026-03-20', '2026-03-20', 1, '병원 방문', 'approved', '2026-03-15 10:30:00');
INSERT INTO leave_requests (id, employee_id, leave_type_id, start_date, end_date, total_days, reason, status, created_at) VALUES
  (3, 7, 2, '2026-02-15', '2026-02-16', 2, '감기 몸살', 'approved', '2026-02-14 08:30:00');
INSERT INTO leave_requests (id, employee_id, leave_type_id, start_date, end_date, total_days, reason, status, created_at) VALUES
  (4, 8, 1, '2026-04-01', '2026-04-02', 2, '가족 행사', 'approved', '2026-03-25 11:00:00');
INSERT INTO leave_requests (id, employee_id, leave_type_id, start_date, end_date, total_days, reason, status, created_at) VALUES
  (5, 9, 1, '2026-03-25', '2026-03-25', 1, '개인 사유', 'approved', '2026-03-20 09:15:00');

-- === 승인 대기 4건 ===
INSERT INTO leave_requests (id, employee_id, leave_type_id, start_date, end_date, total_days, reason, status, is_urgent, created_at) VALUES
  (6, 1, 1, '2026-04-16', '2026-04-17', 2, '가족 여행', 'pending', 0, '2026-04-10 09:00:00');
INSERT INTO leave_requests (id, employee_id, leave_type_id, start_date, end_date, total_days, reason, status, is_urgent, urgent_reason, created_at) VALUES
  (7, 6, 2, '2026-04-15', '2026-04-15', 1, '급성 복통', 'pending', 1, '긴급 병원 진료 필요', '2026-04-11 08:00:00');
INSERT INTO leave_requests (id, employee_id, leave_type_id, condolence_subtype_id, start_date, end_date, total_days, reason, status, is_urgent, created_at) VALUES
  (8, 8, 3, 7, '2026-04-18', '2026-04-20', 3, '외조부모 별세', 'pending', 0, '2026-04-10 14:00:00');
INSERT INTO leave_requests (id, employee_id, leave_type_id, start_date, end_date, total_days, reason, status, is_urgent, created_at) VALUES
  (9, 7, 1, '2026-04-21', '2026-04-21', 1, '개인 사유', 'pending', 0, '2026-04-12 10:00:00');

-- === 반려 2건 ===
INSERT INTO leave_requests (id, employee_id, leave_type_id, start_date, end_date, total_days, reason, status, created_at) VALUES
  (10, 1, 1, '2026-04-06', '2026-04-07', 2, '개인 사유', 'rejected', '2026-03-30 09:30:00');
INSERT INTO leave_requests (id, employee_id, leave_type_id, start_date, end_date, total_days, reason, status, created_at) VALUES
  (11, 9, 1, '2026-04-10', '2026-04-11', 2, '개인 사유', 'rejected', '2026-04-05 09:00:00');

-- === 회수 1건 ===
INSERT INTO leave_requests (id, employee_id, leave_type_id, start_date, end_date, total_days, reason, status, recall_reason, created_at) VALUES
  (12, 6, 1, '2026-04-08', '2026-04-09', 2, '여행 계획', 'recalled', '일정 변경', '2026-04-01 09:00:00');

-- === 취소 1건 ===
INSERT INTO leave_requests (id, employee_id, leave_type_id, start_date, end_date, total_days, reason, status, created_at) VALUES
  (13, 7, 1, '2026-03-28', '2026-03-28', 1, '개인 사유', 'cancelled', '2026-03-20 11:00:00');

-- === 예정된 휴가 2건 (approved) ===
INSERT INTO leave_requests (id, employee_id, leave_type_id, start_date, end_date, total_days, reason, status, created_at) VALUES
  (14, 8, 1, '2026-04-14', '2026-04-14', 1, '개인 사유', 'approved', '2026-04-07 09:00:00');
INSERT INTO leave_requests (id, employee_id, leave_type_id, start_date, end_date, total_days, reason, status, created_at) VALUES
  (15, 10, 1, '2026-04-15', '2026-04-16', 2, '가족 여행', 'approved', '2026-04-08 10:00:00');

-- ============================================================
-- 11. 결재 단계 (approval_steps)
-- ============================================================
-- 경영지원팀: 기안→이팀장(2) 검토→박원장(3) 결재
-- 돌봄서비스팀: 기안→강과장(10) 검토→박원장(3) 결재
-- 팀장(강과장): 기안→박원장(3) 결재

-- Req 1: 김직원 연차 (approved) — 경영지원팀
INSERT INTO approval_steps (id, request_id, step_order, step_type, assigned_to, acted_by, status, approver_position, approver_dept_name, acted_at, created_at) VALUES
  (1,  1, 1, 'draft',    1, 1, 'approved', '사원', '경영지원팀', '2026-03-05 09:00:00', '2026-03-05 09:00:00'),
  (2,  1, 2, 'review',   2, 2, 'approved', '팀장', '경영지원팀', '2026-03-06 10:00:00', '2026-03-05 09:00:00'),
  (3,  1, 3, 'approval', 3, 3, 'approved', '원장', '경영지원팀', '2026-03-07 11:00:00', '2026-03-05 09:00:00');

-- Req 2: 박사원 연차 (approved) — 경영지원팀
INSERT INTO approval_steps (id, request_id, step_order, step_type, assigned_to, acted_by, status, approver_position, approver_dept_name, acted_at, created_at) VALUES
  (4,  2, 1, 'draft',    6, 6, 'approved', '사원', '경영지원팀', '2026-03-15 10:30:00', '2026-03-15 10:30:00'),
  (5,  2, 2, 'review',   2, 2, 'approved', '팀장', '경영지원팀', '2026-03-16 09:00:00', '2026-03-15 10:30:00'),
  (6,  2, 3, 'approval', 3, 3, 'approved', '원장', '경영지원팀', '2026-03-17 14:00:00', '2026-03-15 10:30:00');

-- Req 3: 한미영 병가 (approved) — 경영지원팀
INSERT INTO approval_steps (id, request_id, step_order, step_type, assigned_to, acted_by, status, approver_position, approver_dept_name, acted_at, created_at) VALUES
  (7,  3, 1, 'draft',    7, 7, 'approved', '주임', '경영지원팀', '2026-02-14 08:30:00', '2026-02-14 08:30:00'),
  (8,  3, 2, 'review',   2, 2, 'approved', '팀장', '경영지원팀', '2026-02-14 10:00:00', '2026-02-14 08:30:00'),
  (9,  3, 3, 'approval', 3, 3, 'approved', '원장', '경영지원팀', '2026-02-14 15:00:00', '2026-02-14 08:30:00');

-- Req 4: 송대리 연차 (approved) — 돌봄서비스팀
INSERT INTO approval_steps (id, request_id, step_order, step_type, assigned_to, acted_by, status, approver_position, approver_dept_name, acted_at, created_at) VALUES
  (10, 4, 1, 'draft',    8, 8, 'approved', '대리', '돌봄서비스팀', '2026-03-25 11:00:00', '2026-03-25 11:00:00'),
  (11, 4, 2, 'review',  10,10, 'approved', '과장', '돌봄서비스팀', '2026-03-26 09:30:00', '2026-03-25 11:00:00'),
  (12, 4, 3, 'approval', 3, 3, 'approved', '원장', '경영지원팀', '2026-03-27 10:00:00', '2026-03-25 11:00:00');

-- Req 5: 윤주임 연차 (approved) — 돌봄서비스팀
INSERT INTO approval_steps (id, request_id, step_order, step_type, assigned_to, acted_by, status, approver_position, approver_dept_name, acted_at, created_at) VALUES
  (13, 5, 1, 'draft',    9, 9, 'approved', '주임', '돌봄서비스팀', '2026-03-20 09:15:00', '2026-03-20 09:15:00'),
  (14, 5, 2, 'review',  10,10, 'approved', '과장', '돌봄서비스팀', '2026-03-21 10:00:00', '2026-03-20 09:15:00'),
  (15, 5, 3, 'approval', 3, 3, 'approved', '원장', '경영지원팀', '2026-03-22 11:00:00', '2026-03-20 09:15:00');

-- Req 6: 김직원 연차 (pending) — 팀장 대기
INSERT INTO approval_steps (id, request_id, step_order, step_type, assigned_to, acted_by, status, approver_position, approver_dept_name, acted_at, created_at) VALUES
  (16, 6, 1, 'draft',    1, 1, 'approved', '사원', '경영지원팀', '2026-04-10 09:00:00', '2026-04-10 09:00:00'),
  (17, 6, 2, 'review',   2, NULL, 'pending', '팀장', '경영지원팀', NULL, '2026-04-10 09:00:00'),
  (18, 6, 3, 'approval', 3, NULL, 'pending', '원장', '경영지원팀', NULL, '2026-04-10 09:00:00');

-- Req 7: 박사원 병가 (pending, urgent) — 팀장 대기
INSERT INTO approval_steps (id, request_id, step_order, step_type, assigned_to, acted_by, status, approver_position, approver_dept_name, acted_at, created_at) VALUES
  (19, 7, 1, 'draft',    6, 6, 'approved', '사원', '경영지원팀', '2026-04-11 08:00:00', '2026-04-11 08:00:00'),
  (20, 7, 2, 'review',   2, NULL, 'pending', '팀장', '경영지원팀', NULL, '2026-04-11 08:00:00'),
  (21, 7, 3, 'approval', 3, NULL, 'pending', '원장', '경영지원팀', NULL, '2026-04-11 08:00:00');

-- Req 8: 송대리 경조사 (pending) — 팀장 승인 완료, 원장 대기
INSERT INTO approval_steps (id, request_id, step_order, step_type, assigned_to, acted_by, status, approver_position, approver_dept_name, acted_at, created_at) VALUES
  (22, 8, 1, 'draft',    8, 8, 'approved', '대리', '돌봄서비스팀', '2026-04-10 14:00:00', '2026-04-10 14:00:00'),
  (23, 8, 2, 'review',  10,10, 'approved', '과장', '돌봄서비스팀', '2026-04-11 09:00:00', '2026-04-10 14:00:00'),
  (24, 8, 3, 'approval', 3, NULL, 'pending', '원장', '경영지원팀', NULL, '2026-04-10 14:00:00');

-- Req 9: 한미영 연차 (pending) — 팀장 대기
INSERT INTO approval_steps (id, request_id, step_order, step_type, assigned_to, acted_by, status, approver_position, approver_dept_name, acted_at, created_at) VALUES
  (25, 9, 1, 'draft',    7, 7, 'approved', '주임', '경영지원팀', '2026-04-12 10:00:00', '2026-04-12 10:00:00'),
  (26, 9, 2, 'review',   2, NULL, 'pending', '팀장', '경영지원팀', NULL, '2026-04-12 10:00:00'),
  (27, 9, 3, 'approval', 3, NULL, 'pending', '원장', '경영지원팀', NULL, '2026-04-12 10:00:00');

-- Req 10: 김직원 연차 (rejected) — 팀장 반려
INSERT INTO approval_steps (id, request_id, step_order, step_type, assigned_to, acted_by, status, approver_position, approver_dept_name, comment, acted_at, created_at) VALUES
  (28, 10, 1, 'draft',    1, 1, 'approved', '사원', '경영지원팀', NULL, '2026-03-30 09:30:00', '2026-03-30 09:30:00'),
  (29, 10, 2, 'review',   2, 2, 'rejected', '팀장', '경영지원팀', '해당 기간 필수 근무일입니다', '2026-03-31 10:00:00', '2026-03-30 09:30:00'),
  (30, 10, 3, 'approval', 3, NULL, 'pending', '원장', '경영지원팀', NULL, NULL, '2026-03-30 09:30:00');

-- Req 11: 윤주임 연차 (rejected) — 강과장 반려
INSERT INTO approval_steps (id, request_id, step_order, step_type, assigned_to, acted_by, status, approver_position, approver_dept_name, comment, acted_at, created_at) VALUES
  (31, 11, 1, 'draft',    9, 9, 'approved', '주임', '돌봄서비스팀', NULL, '2026-04-05 09:00:00', '2026-04-05 09:00:00'),
  (32, 11, 2, 'review',  10,10, 'rejected', '과장', '돌봄서비스팀', '팀 내 동시 휴가 인원 초과', '2026-04-06 09:30:00', '2026-04-05 09:00:00'),
  (33, 11, 3, 'approval', 3, NULL, 'pending', '원장', '경영지원팀', NULL, NULL, '2026-04-05 09:00:00');

-- Req 12: 박사원 연차 (recalled) — 팀장 대기 중 회수됨
INSERT INTO approval_steps (id, request_id, step_order, step_type, assigned_to, acted_by, status, approver_position, approver_dept_name, acted_at, created_at) VALUES
  (34, 12, 1, 'draft',    6, 6, 'approved', '사원', '경영지원팀', '2026-04-01 09:00:00', '2026-04-01 09:00:00'),
  (35, 12, 2, 'review',   2, NULL, 'pending', '팀장', '경영지원팀', NULL, '2026-04-01 09:00:00'),
  (36, 12, 3, 'approval', 3, NULL, 'pending', '원장', '경영지원팀', NULL, '2026-04-01 09:00:00');

-- Req 13: 한미영 연차 (cancelled) — 승인 후 취소
INSERT INTO approval_steps (id, request_id, step_order, step_type, assigned_to, acted_by, status, approver_position, approver_dept_name, acted_at, created_at) VALUES
  (37, 13, 1, 'draft',    7, 7, 'approved', '주임', '경영지원팀', '2026-03-20 11:00:00', '2026-03-20 11:00:00'),
  (38, 13, 2, 'review',   2, 2, 'approved', '팀장', '경영지원팀', '2026-03-21 09:00:00', '2026-03-20 11:00:00'),
  (39, 13, 3, 'approval', 3, 3, 'approved', '원장', '경영지원팀', '2026-03-22 10:00:00', '2026-03-20 11:00:00');

-- Req 14: 송대리 연차 (approved, 예정) — 돌봄서비스팀
INSERT INTO approval_steps (id, request_id, step_order, step_type, assigned_to, acted_by, status, approver_position, approver_dept_name, acted_at, created_at) VALUES
  (40, 14, 1, 'draft',    8, 8, 'approved', '대리', '돌봄서비스팀', '2026-04-07 09:00:00', '2026-04-07 09:00:00'),
  (41, 14, 2, 'review',  10,10, 'approved', '과장', '돌봄서비스팀', '2026-04-08 09:30:00', '2026-04-07 09:00:00'),
  (42, 14, 3, 'approval', 3, 3, 'approved', '원장', '경영지원팀', '2026-04-09 10:00:00', '2026-04-07 09:00:00');

-- Req 15: 강과장 연차 (approved, 예정) — 팀장이므로 flow 2 (기안→원장)
INSERT INTO approval_steps (id, request_id, step_order, step_type, assigned_to, acted_by, status, approver_position, approver_dept_name, acted_at, created_at) VALUES
  (43, 15, 1, 'draft',   10,10, 'approved', '과장', '돌봄서비스팀', '2026-04-08 10:00:00', '2026-04-08 10:00:00'),
  (44, 15, 2, 'approval', 3, 3, 'approved', '원장', '경영지원팀', '2026-04-09 14:00:00', '2026-04-08 10:00:00');

-- ============================================================
-- 12. 열람 범위 (승인 완료 건 → 자기 부서 공개)
-- ============================================================
INSERT INTO leave_request_visibility (request_id, department_id) VALUES
  (1, 1),   -- 김직원 → 경영지원팀
  (2, 1),   -- 박사원 → 경영지원팀
  (3, 1),   -- 한미영 → 경영지원팀
  (4, 3),   -- 송대리 → 돌봄서비스팀
  (5, 3),   -- 윤주임 → 돌봄서비스팀
  (14, 3),  -- 송대리 → 돌봄서비스팀
  (15, 3);  -- 강과장 → 돌봄서비스팀

-- ============================================================
-- 13. 알림 데이터
-- ============================================================
-- 승인 요청 알림 (팀장/원장에게)
INSERT INTO notifications (employee_id, type, title, message, target_url, is_read, created_at) VALUES
  -- Req 6: 김직원 pending → 이팀장에게
  (2, 'APPROVAL_REQUEST', '휴가 승인 요청', '김직원님이 연차 2일(04/16~04/17)을 신청했습니다.', '/approvals', 0, '2026-04-10 09:01:00'),
  -- Req 7: 박사원 pending(urgent) → 이팀장에게
  (2, 'APPROVAL_REQUEST', '[긴급] 휴가 승인 요청', '박사원님이 병가 1일(04/15)을 긴급 신청했습니다.', '/approvals', 0, '2026-04-11 08:01:00'),
  -- Req 8: 송대리 pending → 박원장에게 (강과장 이미 승인)
  (3, 'APPROVAL_REQUEST', '휴가 승인 요청', '송대리님이 경조사 3일(04/18~04/20)을 신청했습니다. (팀장 승인 완료)', '/approvals', 0, '2026-04-11 09:01:00'),
  -- Req 9: 한미영 pending → 이팀장에게
  (2, 'APPROVAL_REQUEST', '휴가 승인 요청', '한미영님이 연차 1일(04/21)을 신청했습니다.', '/approvals', 0, '2026-04-12 10:01:00'),

  -- 반려 알림 (신청자에게)
  -- Req 10: 김직원에게 반려 알림 (읽음)
  (1, 'APPROVAL_REJECTED', '휴가 신청 반려', '연차(04/06~04/07) 신청이 반려되었습니다. 사유: 해당 기간 필수 근무일입니다', '/leaves/10', 1, '2026-03-31 10:01:00'),
  -- Req 11: 윤주임에게 반려 알림 (미읽음)
  (9, 'APPROVAL_REJECTED', '휴가 신청 반려', '연차(04/10~04/11) 신청이 반려되었습니다. 사유: 팀 내 동시 휴가 인원 초과', '/leaves/11', 0, '2026-04-06 09:31:00'),

  -- 승인 완료 알림 (신청자에게, 읽음)
  (1, 'APPROVAL_COMPLETED', '휴가 승인 완료', '연차(03/10~03/11) 2일이 최종 승인되었습니다.', '/leaves/1', 1, '2026-03-07 11:01:00'),
  (8, 'APPROVAL_COMPLETED', '휴가 승인 완료', '연차(04/14) 1일이 최종 승인되었습니다.', '/leaves/14', 1, '2026-04-09 10:01:00');

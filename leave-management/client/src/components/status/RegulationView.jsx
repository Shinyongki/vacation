import React from 'react';
import { BookOpen, Calendar, Clock, AlertCircle, FileText, Scale } from 'lucide-react';

const sections = [
  {
    icon: Calendar,
    title: '연차휴가',
    items: [
      '1년 미만 근무: 1개월 개근 시 1일 발생 (최대 11일)',
      '1년 이상 근무: 15일',
      '3년 이상 근무: 매 2년마다 1일 가산 (최대 25일)',
      '연차는 발생일로부터 1년 이내 사용',
    ]
  },
  {
    icon: FileText,
    title: '병가',
    items: [
      '연 60일 이내',
      '진단서 등 증빙서류 첨부 필수',
      '사후 신청 가능',
    ]
  },
  {
    icon: Scale,
    title: '경조사 휴가',
    items: [
      '본인 결혼: 5일',
      '자녀 결혼: 1일',
      '배우자 출산: 20일 (분할 사용 가능, 3회)',
      '부모/배우자 부모 사망: 5일',
      '배우자 사망: 5일',
      '자녀 사망: 5일',
      '조부모/외조부모 사망: 3일 (배우자 조부모 포함)',
      '형제자매 사망: 3일 (배우자 형제자매 포함)',
    ]
  },
  {
    icon: BookOpen,
    title: '공가',
    items: [
      '법률에 따른 의무 이행 시 부여',
      '증빙서류 첨부 필수',
      '사후 신청 가능',
    ]
  },
  {
    icon: Clock,
    title: '출산휴가',
    items: [
      '출산 전후 90일',
      '여성 직원만 신청 가능',
      '증빙서류 첨부 필수',
    ]
  },
  {
    icon: Clock,
    title: '생리휴가',
    items: [
      '월 1일',
      '여성 직원만 신청 가능',
      '사후 신청 불가',
    ]
  },
  {
    icon: AlertCircle,
    title: '포상휴가',
    items: [
      'HR 관리자가 별도 부여',
      '사후 신청 불가',
    ]
  },
];

const approvalRules = [
  '모든 휴가 신청은 결재를 거쳐야 합니다.',
  '결재 라인: 기안 → 검토(팀장) → 결재(원장)',
  '팀장의 휴가는 원장이 직접 결재합니다.',
  '반려된 신청은 사유를 확인한 후 재상신할 수 있습니다.',
  '승인 전 회수하여 수정 후 재기안할 수 있습니다.',
  '긴급 신청 시 결재자와 대결자에게 즉시 알림이 발송됩니다.',
];

const retroactiveRules = [
  '과거 날짜의 휴가는 사후 신청으로 처리됩니다.',
  '사후 신청 허용 사유: 긴급 업무, 출장 중, 시스템 장애, 건강 사유, 천재지변, 기타 불가피한 사유',
  '연차, 포상휴가, 생리휴가는 사후 신청이 불가합니다.',
];

const RegulationView = () => {
  return (
    <div>
      <div className="page-header">
        <h2>휴가 규정</h2>
      </div>

      {/* 휴가 유형별 규정 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '20px' }}>
        {sections.map(section => (
          <div key={section.title} className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <section.icon size={20} style={{ color: '#1B5E9E' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>{section.title}</h3>
            </div>
            <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {section.items.map((item, i) => (
                <li key={i} style={{ fontSize: '14px', color: '#4A5568', lineHeight: 1.6 }}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* 결재 규정 */}
      <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>결재 규정</h3>
        <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {approvalRules.map((rule, i) => (
            <li key={i} style={{ fontSize: '14px', color: '#4A5568', lineHeight: 1.6 }}>{rule}</li>
          ))}
        </ul>
      </div>

      {/* 사후 신청 규정 */}
      <div className="card" style={{ padding: '20px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>사후 신청 규정</h3>
        <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {retroactiveRules.map((rule, i) => (
            <li key={i} style={{ fontSize: '14px', color: '#4A5568', lineHeight: 1.6 }}>{rule}</li>
          ))}
        </ul>
      </div>

      {/* 시간연차 안내 */}
      <div className="card" style={{ padding: '20px', marginTop: '16px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>시간연차 안내</h3>
        <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <li style={{ fontSize: '14px', color: '#4A5568', lineHeight: 1.6 }}>근무시간: 09:00 ~ 18:00 (점심시간 12:00~13:00 제외)</li>
          <li style={{ fontSize: '14px', color: '#4A5568', lineHeight: 1.6 }}>실 근무시간: 8시간</li>
          <li style={{ fontSize: '14px', color: '#4A5568', lineHeight: 1.6 }}>시간연차 사용 시 점심시간은 자동으로 제외됩니다.</li>
          <li style={{ fontSize: '14px', color: '#4A5568', lineHeight: 1.6 }}>8시간 = 1일로 환산됩니다.</li>
        </ul>
      </div>
    </div>
  );
};

export default RegulationView;

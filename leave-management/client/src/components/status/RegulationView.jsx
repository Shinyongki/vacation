import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

/* ── 스타일 헬퍼 ── */
const pill = (variant) => {
  const map = {
    blue:   { background: '#EFF6FF', color: '#1E40AF' },
    green:  { background: '#ECFDF5', color: '#047857' },
    orange: { background: '#FFF7ED', color: '#C2410C' },
    gray:   { background: '#F3F5F7', color: '#5A6E82' },
  };
  return {
    display: 'inline-block',
    fontSize: '12px',
    fontWeight: 500,
    padding: '2px 10px',
    borderRadius: '999px',
    marginLeft: '6px',
    ...map[variant],
  };
};

const hl = (variant) => {
  const map = {
    blue:   { background: '#EFF6FF', color: '#1B5E9E' },
    orange: { background: '#FFF7ED', color: '#C2410C' },
  };
  return {
    display: 'inline',
    padding: '2px 6px',
    borderRadius: '4px',
    fontWeight: 500,
    ...map[variant],
  };
};

const sectionTitle = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '15px',
  fontWeight: 500,
  color: '#1B3A5C',
  margin: '0 0 10px 0',
};

const blueDot = {
  width: '6px',
  height: '6px',
  borderRadius: '50%',
  background: '#1B5E9E',
  flexShrink: 0,
};

const divider = { borderTop: '1px solid #EEF0F2', margin: '16px 0' };

const source = (text) => (
  <div style={{ fontSize: '13px', color: '#8A95A3', paddingLeft: '12px', marginTop: '6px' }}>{text}</div>
);

const noteBox = (children) => (
  <div style={{
    background: '#F9FAFB',
    border: '1px solid #EEF0F2',
    borderRadius: '6px',
    padding: '12px 14px',
    fontSize: '13px',
    color: '#5A6E82',
    lineHeight: 1.6,
    marginTop: '16px',
  }}>
    {children}
  </div>
);

const liStyle = { fontSize: '14px', color: '#4A5568', lineHeight: 1.7 };
const listWrap = { margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' };

const SectionHead = ({ children }) => (
  <div style={sectionTitle}><span style={blueDot} /><span>{children}</span></div>
);

/* ── 아코디언 아이템 ── */
const AccordionItem = ({ title, badges, isOpen, onToggle, children }) => (
  <div className="card" style={{ marginBottom: '8px', overflow: 'hidden' }}>
    <button
      onClick={onToggle}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '14px 20px',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      {isOpen
        ? <ChevronDown size={18} color="#1B3A5C" />
        : <ChevronRight size={18} color="#8A95A3" />
      }
      <span style={{ fontSize: '16px', fontWeight: 500, color: '#1B3A5C' }}>{title}</span>
      {badges}
    </button>
    {isOpen && (
      <div style={{ padding: '0 20px 20px 46px' }}>
        {children}
      </div>
    )}
  </div>
);

/* ── 메인 컴포넌트 ── */
const RegulationView = () => {
  const [openItems, setOpenItems] = useState({});

  const toggle = (key) => {
    setOpenItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div>
      {/* 페이지 헤더 */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 500, color: '#1B3A5C', margin: '0 0 4px 0' }}>
          휴가 규정
        </h2>
        <p style={{ fontSize: '14px', fontWeight: 400, color: '#8A95A3', margin: 0 }}>
          재단법인 경상남도사회서비스원 복무규정 제4절 (2025.03.27 개정) 기준
        </p>
      </div>

      {/* 1. 연차휴가 */}
      <AccordionItem
        title="연차휴가"
        badges={<><span style={pill('blue')}>유급</span><span style={pill('green')}>자동 계산</span></>}
        isOpen={!!openItems['annual']}
        onToggle={() => toggle('annual')}
      >
        <SectionHead>발생 기준</SectionHead>
        <ul style={listWrap}>
          <li style={liStyle}>근속 1년 미만: 1개월 개근 시 <span style={hl('blue')}>1일</span> 발생 (최대 11일)</li>
          <li style={liStyle}>근속 1년 이상 (80% 이상 출근): <span style={hl('blue')}>15일</span></li>
          <li style={liStyle}>근속 3년 이상: 매 2년마다 <span style={hl('blue')}>+1일</span> 가산 (최대 <span style={hl('blue')}>25일</span>)</li>
        </ul>
        {source('근거: 복무규정 제23조 ①②③')}

        <div style={divider} />

        <SectionHead>사용 방법</SectionHead>
        <ul style={listWrap}>
          <li style={liStyle}>종일 사용, 오전반차(09:00~14:00), 오후반차(14:00~18:00), 시간연차(30분 단위) 가능</li>
          <li style={liStyle}>시간연차: <span style={hl('blue')}>8시간 = 1일</span> 차감, 점심시간(12:00~13:00) 자동 제외</li>
        </ul>

        <div style={divider} />

        <SectionHead>공제 규정</SectionHead>
        <ul style={listWrap}>
          <li style={liStyle}>지각·조퇴·외출 누계 <span style={hl('orange')}>8시간 = 연차 1일 공제</span></li>
          <li style={liStyle}>연 6일 초과 병가일수 공제 (단, 진단서 첨부 시 비공제)</li>
        </ul>
        {source('근거: 복무규정 제24조 ②③')}

        {noteBox(
          <span>
            <span style={{ fontWeight: 500, color: '#1B3A5C' }}>유의사항:</span> 회계연도(1~12월) 기준으로 계산하며, 당해 미사용분은 소멸됩니다. 휴가기간 중 토요일·공휴일은 일수에 산입하지 않습니다.
          </span>
        )}
      </AccordionItem>

      {/* 2. 병가 */}
      <AccordionItem
        title="병가"
        badges={<span style={pill('blue')}>유급</span>}
        isOpen={!!openItems['sick']}
        onToggle={() => toggle('sick')}
      >
        <SectionHead>일수 한도</SectionHead>
        <ul style={listWrap}>
          <li style={liStyle}>일반 질병·부상: 연 <span style={hl('blue')}>60일</span> 이내</li>
          <li style={liStyle}>업무상 부상·질병: 연 <span style={hl('blue')}>180일</span> 이내</li>
        </ul>
        {source('근거: 복무규정 제28조 ①②')}

        <div style={divider} />

        <SectionHead>진단서 첨부</SectionHead>
        <ul style={listWrap}>
          <li style={liStyle}><span style={hl('orange')}>6일 초과 시 의사 진단서 필수</span></li>
        </ul>
        {source('근거: 복무규정 제28조 ③')}

        {noteBox(
          <span><span style={{ fontWeight: 500, color: '#1B3A5C' }}>참고:</span> 전염병으로 타 직원 건강에 영향 우려 시에도 병가 허가 가능</span>
        )}
      </AccordionItem>

      {/* 3. 공가 */}
      <AccordionItem
        title="공가"
        badges={<span style={pill('blue')}>유급</span>}
        isOpen={!!openItems['official']}
        onToggle={() => toggle('official')}
      >
        <SectionHead>허가 사유</SectionHead>
        <ol style={{ ...listWrap, paddingLeft: '18px' }}>
          <li style={liStyle}>재단 관련 업무 연구</li>
          <li style={liStyle}>법률에 의한 투표 참여</li>
          <li style={liStyle}>병역법에 의한 소집·검열·점호</li>
          <li style={liStyle}>국가기관 등 요청에 의한 행사 참여</li>
          <li style={liStyle}>천재지변·화재·수해 등으로 출근 불가</li>
          <li style={liStyle}>건강진단·검진 수검</li>
        </ol>
        {source('근거: 복무규정 제27조')}

        {noteBox(
          <span><span style={{ fontWeight: 500, color: '#1B3A5C' }}>참고:</span> 해당 기간 중 부여되며, 증빙서류 첨부가 필요합니다.</span>
        )}
      </AccordionItem>

      {/* 4. 경조사휴가 */}
      <AccordionItem
        title="경조사휴가"
        badges={<><span style={pill('blue')}>유급</span><span style={pill('orange')}>2025.03.27 개정</span></>}
        isOpen={!!openItems['family']}
        onToggle={() => toggle('family')}
      >
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: '80px' }}>구분</th>
                <th>대상</th>
                <th style={{ width: '80px', textAlign: 'center' }}>일수</th>
                <th style={{ width: '140px' }}>비고</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td rowSpan={2} style={{ fontWeight: 500, verticalAlign: 'middle' }}>결혼</td>
                <td>본인</td>
                <td style={{ textAlign: 'center', color: '#1B5E9E', fontWeight: 500 }}>5일</td>
                <td></td>
              </tr>
              <tr>
                <td>자녀</td>
                <td style={{ textAlign: 'center', color: '#1B5E9E', fontWeight: 500 }}>1일</td>
                <td></td>
              </tr>
              <tr style={{ background: '#FAFCFF' }}>
                <td style={{ fontWeight: 500 }}>출산</td>
                <td>배우자</td>
                <td style={{ textAlign: 'center', color: '#1B5E9E', fontWeight: 500 }}>
                  <span style={hl('orange')}>20일</span>
                </td>
                <td><span style={pill('orange')}>개정</span></td>
              </tr>
              <tr>
                <td style={{ fontWeight: 500 }}>입양</td>
                <td>본인</td>
                <td style={{ textAlign: 'center', color: '#1B5E9E', fontWeight: 500 }}>20일</td>
                <td></td>
              </tr>
              <tr>
                <td rowSpan={5} style={{ fontWeight: 500, verticalAlign: 'middle' }}>사망</td>
                <td>배우자, 본인·배우자의 부모</td>
                <td style={{ textAlign: 'center', color: '#1B5E9E', fontWeight: 500 }}>5일</td>
                <td></td>
              </tr>
              <tr>
                <td>본인·배우자의 조부모·외조부모</td>
                <td style={{ textAlign: 'center', color: '#1B5E9E', fontWeight: 500 }}>3일</td>
                <td></td>
              </tr>
              <tr>
                <td>자녀와 그 자녀의 배우자</td>
                <td style={{ textAlign: 'center', color: '#1B5E9E', fontWeight: 500 }}>3일</td>
                <td></td>
              </tr>
              <tr>
                <td>본인·배우자의 형제자매와 그 배우자</td>
                <td style={{ textAlign: 'center', color: '#1B5E9E', fontWeight: 500 }}>1일</td>
                <td></td>
              </tr>
              <tr>
                <td>본인·배우자 부모의 형제자매와 그 배우자</td>
                <td style={{ textAlign: 'center', color: '#1B5E9E', fontWeight: 500 }}>1일</td>
                <td></td>
              </tr>
              <tr>
                <td style={{ fontWeight: 500 }}>탈상</td>
                <td>배우자, 본인·배우자의 부모</td>
                <td style={{ textAlign: 'center', color: '#1B5E9E', fontWeight: 500 }}>1일</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>

        {noteBox(
          <>
            <div style={{ marginBottom: '6px' }}>
              <span style={{ fontWeight: 500, color: '#1B3A5C' }}>개정사항 (2025.03.27):</span> 배우자 출산 10일→<span style={hl('orange')}>20일</span>, 분할 사용 1회→<span style={hl('orange')}>3회</span>까지 가능 (출산일로부터 120일 이내)
            </div>
            <div style={{ marginBottom: '6px' }}>
              <span style={{ fontWeight: 500, color: '#1B3A5C' }}>원격지 가산:</span> 원격지일 경우 실제 필요한 왕복 소요 일수를 가산할 수 있습니다.
            </div>
            <div style={{ fontSize: '13px', color: '#8A95A3' }}>근거: 복무규정 제30조 + 별표</div>
          </>
        )}
      </AccordionItem>

      {/* 5. 출산휴가 */}
      <AccordionItem
        title="출산휴가"
        badges={<><span style={pill('blue')}>유급(60일) + 무급</span><span style={pill('gray')}>여성 전용</span></>}
        isOpen={!!openItems['maternity']}
        onToggle={() => toggle('maternity')}
      >
        <SectionHead>휴가 일수</SectionHead>
        <ul style={listWrap}>
          <li style={liStyle}>일반: <span style={hl('blue')}>90일</span> (출산 후 45일 이상 확보)</li>
          <li style={liStyle}>미숙아: <span style={hl('blue')}>100일</span></li>
          <li style={liStyle}>다태아(둘 이상): <span style={hl('blue')}>120일</span> (출산 후 60일 이상)</li>
        </ul>
        {source('근거: 복무규정 제26조 ①')}

        <div style={divider} />

        <SectionHead>유급 기간</SectionHead>
        <ul style={listWrap}>
          <li style={liStyle}>최초 <span style={hl('blue')}>60일</span> 유급 (다태아 75일)</li>
        </ul>

        <div style={divider} />

        <SectionHead>유산·사산 시</SectionHead>
        <ul style={listWrap}>
          <li style={liStyle}>임신 11~15주: 5~10일 / 16~21주: 30일</li>
          <li style={liStyle}>22~27주: 60일 / 28주 이상: 90일</li>
        </ul>
        {source('근거: 복무규정 제26조 ③')}
      </AccordionItem>

      {/* 6. 생리휴가 */}
      <AccordionItem
        title="생리휴가"
        badges={<><span style={pill('orange')}>무급</span><span style={pill('gray')}>여성 전용</span></>}
        isOpen={!!openItems['menstrual']}
        onToggle={() => toggle('menstrual')}
      >
        <SectionHead>일수</SectionHead>
        <ul style={listWrap}>
          <li style={liStyle}>월 <span style={hl('blue')}>1일</span> (무급)</li>
        </ul>
        {source('근거: 복무규정 제26조 ①')}

        {noteBox(
          <span><span style={{ fontWeight: 500, color: '#1B3A5C' }}>유의사항:</span> 여성 직원 청구 시 부여합니다. 사후 신청은 불가합니다.</span>
        )}
      </AccordionItem>

      {/* 7. 포상휴가 */}
      <AccordionItem
        title="포상휴가"
        badges={<span style={pill('blue')}>유급</span>}
        isOpen={!!openItems['reward']}
        onToggle={() => toggle('reward')}
      >
        <SectionHead>부여 기준</SectionHead>
        <ul style={listWrap}>
          <li style={liStyle}>재단 발전에 현저한 공이 있다고 인정할 때 <span style={hl('blue')}>7일 이내</span> 부여</li>
        </ul>
        {source('근거: 복무규정 제29조')}

        {noteBox(
          <span><span style={{ fontWeight: 500, color: '#1B3A5C' }}>참고:</span> 원장 결재로 부여되며, HR관리자가 잔여일수에 반영합니다. 사후 신청은 불가합니다.</span>
        )}
      </AccordionItem>

      {/* 8. 공통 규정 */}
      <AccordionItem
        title="공통 규정"
        badges={null}
        isOpen={!!openItems['common']}
        onToggle={() => toggle('common')}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div>
            <SectionHead>휴가 기간 계산 (제31조)</SectionHead>
            <ul style={listWrap}>
              <li style={liStyle}>휴가 기간 중 토요일·공휴일은 일수에 <span style={{ fontWeight: 500 }}>산입하지 않음</span></li>
              <li style={liStyle}>단, 연차 외 휴가가 30일 이상 연속 시 산입</li>
            </ul>
          </div>

          <div>
            <SectionHead>근무시간 (제13조)</SectionHead>
            <ul style={listWrap}>
              <li style={liStyle}>09:00 ~ 18:00 (1일 8시간, 주 40시간)</li>
              <li style={liStyle}>점심시간: 12:00 ~ 13:00</li>
            </ul>
          </div>

          <div>
            <SectionHead>사후 신청 허용 사유</SectionHead>
            <ul style={listWrap}>
              <li style={liStyle}>긴급 질병·부상 / 전염병 격리</li>
              <li style={liStyle}>가족 사망·위독 / 배우자 긴급 출산</li>
              <li style={liStyle}>천재지변 / 긴급 소집·법적 의무</li>
            </ul>
          </div>

          <div>
            <SectionHead>결재 절차</SectionHead>
            <ul style={listWrap}>
              <li style={liStyle}>소속 부서장 승인 → 결재 라인에 따른 순차 승인</li>
              <li style={liStyle}>긴급 건은 결재자 + 대결자 동시 알림</li>
            </ul>
          </div>
        </div>
      </AccordionItem>
    </div>
  );
};

export default RegulationView;

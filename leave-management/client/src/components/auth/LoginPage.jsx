import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import PasswordChangeModal from './PasswordChangeModal';

const DEMO_ACCOUNTS = [
  { number: '2024001', role: '직원 (staff)', name: '김직원' },
  { number: '2023001', role: '팀장 (team_lead)', name: '이팀장' },
  { number: '2020001', role: '원장 (director)', name: '박원장' },
  { number: '2022001', role: 'HR관리자 (hr_admin)', name: '최관리' },
  { number: '2021001', role: '재단담당자 (foundation)', name: '정재단' }
];

function getRoleRedirect(role) {
  switch (role) {
    case 'hr_admin':
      return '/admin';
    case 'foundation':
      return '/reports';
    default:
      return '/dashboard';
  }
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, updateUser } = useAuth();

  const [employeeNumber, setEmployeeNumber] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [loginUser, setLoginUser] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!employeeNumber.trim()) {
      setError('사번을 입력해 주세요.');
      return;
    }
    if (!password) {
      setError('비밀번호를 입력해 주세요.');
      return;
    }

    setSubmitting(true);
    try {
      const userData = await login(employeeNumber.trim(), password);
      setLoginUser(userData);

      if (userData.isInitialPassword) {
        setShowPasswordModal(true);
      } else {
        const from = location.state?.from?.pathname;
        navigate(from || getRoleRedirect(userData.role), { replace: true });
      }
    } catch (err) {
      setError(err.error || err.message || '로그인에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordChanged = () => {
    setShowPasswordModal(false);
    if (loginUser) {
      navigate(getRoleRedirect(loginUser.role), { replace: true });
    }
  };

  const DEMO_PASSWORDS = {
    '2024001': '6517',
    '2023001': '850515',
    '2020001': '750820',
    '2022001': '900310',
    '2021001': '801125',
  };

  const handleDemoClick = (number) => {
    setEmployeeNumber(number);
    setPassword(DEMO_PASSWORDS[number] || '');
    setError('');
  };

  // 테스트 바로가기 — 클릭만으로 즉시 로그인
  const QUICK_LOGINS = [
    { label: '사원', number: '2024001', password: '6517' },
    { label: '팀장', number: '2023001', password: '850515' },
    { label: '원장', number: '2020001', password: '750820' },
    { label: '관리', number: '2022001', password: '900310' },
    { label: '재단', number: '2021001', password: '801125' },
  ];

  const handleQuickLogin = async (account) => {
    setError('');
    setSubmitting(true);
    try {
      const userData = await login(account.number, account.password);
      setLoginUser(userData);
      if (userData.isInitialPassword) {
        setShowPasswordModal(true);
      } else {
        navigate(getRoleRedirect(userData.role), { replace: true });
      }
    } catch (err) {
      setError(err.error || err.message || '로그인에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Logo area */}
        <div style={styles.logoArea}>
          <div style={styles.logo}>HM</div>
        </div>

        {/* Title */}
        <h1 style={styles.title}>휴가관리 시스템</h1>
        <p style={styles.subtitle}>재단법인 경상남도사회서비스원</p>

        {/* Error */}
        {error && (
          <div style={styles.error}>{error}</div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>사번</label>
            <input
              type="text"
              value={employeeNumber}
              onChange={(e) => setEmployeeNumber(e.target.value)}
              style={styles.input}
              placeholder="사번을 입력하세요"
              autoFocus
              autoComplete="username"
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              placeholder="비밀번호를 입력하세요"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            style={{
              ...styles.loginButton,
              opacity: submitting ? 0.5 : 1,
              cursor: submitting ? 'not-allowed' : 'pointer'
            }}
          >
            {submitting ? '로그인 중...' : '로그인'}
          </button>
        </form>

        {/* 테스트 바로가기 */}
        <div style={{ marginTop: '20px', borderTop: '0.5px solid #EEF0F2', paddingTop: '14px' }}>
          <div style={{ fontSize: '12px', color: '#8A95A3', textAlign: 'center', marginBottom: '10px' }}>
            테스트 바로가기
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
            {QUICK_LOGINS.map(account => (
              <button
                key={account.number}
                type="button"
                disabled={submitting}
                onClick={() => handleQuickLogin(account)}
                style={{
                  padding: '8px 4px',
                  background: '#F3F5F7',
                  border: '1px solid #DDE1E7',
                  borderRadius: '6px',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#5A6E82',
                  textAlign: 'center',
                  opacity: submitting ? 0.5 : 1,
                }}
              >
                {account.label}
              </button>
            ))}
          </div>
        </div>

        {/* Demo accounts toggle */}
        <div style={styles.demoSection}>
          <button
            type="button"
            onClick={() => setShowDemo(!showDemo)}
            style={styles.demoToggle}
          >
            {showDemo ? '데모 계정 안내 접기' : '데모 계정 안내'}
            <span style={{
              display: 'inline-block',
              marginLeft: '4px',
              transform: showDemo ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s'
            }}>&#9662;</span>
          </button>

          {showDemo && (
            <div style={styles.demoList}>
              <div style={styles.demoHint}>
                비밀번호: 생년월일 6자리 (클릭하면 자동 입력)
              </div>
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.number}
                  type="button"
                  onClick={() => handleDemoClick(account.number)}
                  style={styles.demoItem}
                >
                  <span style={styles.demoNumber}>{account.number}</span>
                  <span style={styles.demoName}>{account.name}</span>
                  <span style={styles.demoRole}>{account.role}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Password change modal */}
      {showPasswordModal && (
        <PasswordChangeModal
          isInitial={true}
          onClose={handlePasswordChanged}
        />
      )}
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #1B3A5C 0%, #2E6DA4 50%, #1B5E9E 100%)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Malgun Gothic", sans-serif',
    padding: '20px'
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: '10px',
    padding: '36px 32px 28px',
    width: '100%',
    maxWidth: '380px'
  },
  logoArea: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '16px'
  },
  logo: {
    width: '48px',
    height: '48px',
    borderRadius: '10px',
    backgroundColor: '#1B3A5C',
    color: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    fontWeight: 600,
    letterSpacing: '1px'
  },
  title: {
    textAlign: 'center',
    fontSize: '18px',
    fontWeight: 600,
    color: '#1B3A5C',
    margin: '0 0 4px 0'
  },
  subtitle: {
    textAlign: 'center',
    fontSize: '12px',
    color: '#8A95A3',
    margin: '0 0 24px 0'
  },
  error: {
    backgroundColor: '#FEF2F2',
    border: '0.5px solid #FECACA',
    borderRadius: '6px',
    padding: '8px 12px',
    fontSize: '12px',
    color: '#991B1B',
    marginBottom: '12px'
  },
  form: {
    display: 'flex',
    flexDirection: 'column'
  },
  field: {
    marginBottom: '14px'
  },
  label: {
    display: 'block',
    fontSize: '12px',
    fontWeight: 400,
    color: '#8A95A3',
    marginBottom: '4px'
  },
  input: {
    width: '100%',
    height: '36px',
    padding: '0 10px',
    fontSize: '13px',
    border: '1px solid #CDD1D7',
    borderRadius: '6px',
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    color: '#333333'
  },
  loginButton: {
    width: '100%',
    height: '40px',
    backgroundColor: '#1B5E9E',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
    marginTop: '4px'
  },
  demoSection: {
    marginTop: '20px',
    borderTop: '0.5px solid #EEF0F2',
    paddingTop: '14px'
  },
  demoToggle: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    background: 'none',
    border: 'none',
    color: '#5A6E82',
    fontSize: '12px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    padding: '4px 0'
  },
  demoList: {
    marginTop: '10px'
  },
  demoHint: {
    fontSize: '11px',
    color: '#8A95A3',
    textAlign: 'center',
    marginBottom: '8px'
  },
  demoItem: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    padding: '7px 10px',
    backgroundColor: '#F6F7F9',
    border: '0.5px solid #EEF0F2',
    borderRadius: '6px',
    marginBottom: '4px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '12px',
    textAlign: 'left',
    gap: '8px'
  },
  demoNumber: {
    color: '#1B5E9E',
    fontWeight: 500,
    minWidth: '60px'
  },
  demoName: {
    color: '#333333',
    minWidth: '48px'
  },
  demoRole: {
    color: '#8A95A3',
    fontSize: '11px',
    marginLeft: 'auto'
  }
};

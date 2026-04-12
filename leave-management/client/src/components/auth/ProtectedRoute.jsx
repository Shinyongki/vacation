import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function ProtectedRoute({ children, roles }) {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Malgun Gothic", sans-serif',
        color: '#5A6E82',
        fontSize: '13px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '32px',
            height: '32px',
            border: '3px solid #E8ECF0',
            borderTopColor: '#1B5E9E',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 12px'
          }} />
          <span>로딩 중...</span>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && roles.length > 0 && !roles.includes(user.role)) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Malgun Gothic", sans-serif',
        color: '#333333',
        fontSize: '13px'
      }}>
        <div style={{
          textAlign: 'center',
          padding: '40px',
          background: '#FFFFFF',
          border: '0.5px solid #DDE1E7',
          borderRadius: '8px'
        }}>
          <div style={{ fontSize: '15px', fontWeight: 500, color: '#1B3A5C', marginBottom: '8px' }}>
            접근 권한 없음
          </div>
          <div style={{ color: '#5A6E82', marginBottom: '16px' }}>
            이 페이지에 접근할 권한이 없습니다.
          </div>
          <a href="/dashboard" style={{
            color: '#1B5E9E',
            textDecoration: 'none',
            fontSize: '12px',
            fontWeight: 500
          }}>
            대시보드로 이동
          </a>
        </div>
      </div>
    );
  }

  return children;
}

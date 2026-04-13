import React, { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import Badge from './Badge';

const ROLE_LABELS = {
  staff: '직원',
  team_lead: '팀장',
  director: '원장',
  hr_admin: 'HR관리자',
  foundation: '재단',
};

const MENU_CONFIG = {
  staff: [
    {
      group: '나의 공간',
      items: [
        { label: '대시보드', path: '/dashboard' },
      ],
    },
    {
      group: '휴가 관리',
      items: [
        { label: '휴가 신청', path: '/leaves/new' },
        { label: '내 휴가 목록', path: '/leaves' },
      ],
    },
    {
      group: '현황',
      items: [
        { label: '팀 캘린더', path: '/calendar' },
      ],
    },
    {
      group: '정보',
      items: [
        { label: '휴가 규정', path: '/regulations' },
      ],
    },
  ],
  team_lead: [
    {
      group: '나의 공간',
      items: [
        { label: '대시보드', path: '/dashboard' },
      ],
    },
    {
      group: '휴가 관리',
      items: [
        { label: '휴가 신청', path: '/leaves/new' },
        { label: '내 휴가 목록', path: '/leaves' },
      ],
    },
    {
      group: '승인 관리',
      items: [
        { label: '승인 대기', path: '/approvals' },
      ],
    },
    {
      group: '현황',
      items: [
        { label: '팀 캘린더', path: '/calendar' },
        { label: '팀원 현황', path: '/team-status' },
      ],
    },
    {
      group: '정보',
      items: [
        { label: '휴가 규정', path: '/regulations' },
      ],
    },
  ],
  director: [
    {
      group: '나의 공간',
      items: [
        { label: '대시보드', path: '/dashboard' },
      ],
    },
    {
      group: '휴가 관리',
      items: [
        { label: '휴가 신청', path: '/leaves/new' },
        { label: '내 휴가 목록', path: '/leaves' },
      ],
    },
    {
      group: '승인 관리',
      items: [
        { label: '승인 대기', path: '/approvals' },
      ],
    },
    {
      group: '현황',
      items: [
        { label: '팀 캘린더', path: '/calendar' },
        { label: '팀원 현황', path: '/team-status' },
        { label: '전체 현황', path: '/full-status' },
      ],
    },
    {
      group: '보고서',
      items: [
        { label: '보고서', path: '/reports' },
      ],
    },
    {
      group: '정보',
      items: [
        { label: '휴가 규정', path: '/regulations' },
      ],
    },
  ],
  hr_admin: [
    {
      group: '나의 공간',
      items: [
        { label: '대시보드', path: '/dashboard' },
      ],
    },
    {
      group: '휴가 관리',
      items: [
        { label: '휴가 신청', path: '/leaves/new' },
        { label: '내 휴가 목록', path: '/leaves' },
      ],
    },
    {
      group: '현황',
      items: [
        { label: '팀 캘린더', path: '/calendar' },
        { label: '팀원 현황', path: '/team-status' },
        { label: '전체 현황', path: '/full-status' },
      ],
    },
    {
      group: '보고서',
      items: [
        { label: '보고서', path: '/reports' },
      ],
    },
    {
      group: '관리',
      items: [
        { label: '관리자 설정', path: '/admin' },
      ],
    },
    {
      group: '정보',
      items: [
        { label: '휴가 규정', path: '/regulations' },
      ],
    },
  ],
  foundation: [
    {
      group: '시설 현황',
      items: [
        { label: '전체 현황', path: '/full-status' },
      ],
    },
    {
      group: '보고서',
      items: [
        { label: '보고서', path: '/reports' },
      ],
    },
    {
      group: '데이터 검증',
      items: [
        { label: '데이터 검증', path: '/verification' },
      ],
    },
  ],
};

const Sidebar = ({ user }) => {
  const location = useLocation();
  const role = user?.role || 'staff';
  const menuGroups = MENU_CONFIG[role] || MENU_CONFIG.staff;
  const [collapsed, setCollapsed] = useState({});

  const toggleGroup = (group) => {
    setCollapsed((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  const isActive = (path) => {
    if (path === '/dashboard') return location.pathname === '/' || location.pathname === '/dashboard';
    if (path === '/leaves') return location.pathname === '/leaves' && !location.pathname.includes('/new');
    return location.pathname.startsWith(path);
  };

  return (
    <aside className="app-sidebar">
      <nav className="app-sidebar__menu">
        {menuGroups.map((group) => {
          const isCollapsed = collapsed[group.group];
          return (
            <div key={group.group} className="app-sidebar__group">
              <div
                className="app-sidebar__group-label"
                onClick={() => toggleGroup(group.group)}
              >
                <span>{group.group}</span>
                <ChevronDown
                  size={12}
                  className={`app-sidebar__group-arrow ${isCollapsed ? 'app-sidebar__group-arrow--collapsed' : ''}`}
                />
              </div>
              {!isCollapsed &&
                group.items.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`app-sidebar__item ${isActive(item.path) ? 'app-sidebar__item--active' : ''}`}
                  >
                    <span>{item.label}</span>
                  </Link>
                ))}
            </div>
          );
        })}
      </nav>
      <div className="app-sidebar__footer">
        <div className="app-sidebar__user-dept">
          {user?.department || ''}
        </div>
        <div className="app-sidebar__user-info">
          <span className="app-sidebar__user-name">{user?.name || '사용자'}</span>
          <span className="app-sidebar__user-position">{user?.position || ''}</span>
          <Badge variant="primary" size="sm">
            {ROLE_LABELS[role] || role}
          </Badge>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;

import React from 'react';
import Badge from './Badge';

const STATUS_CONFIG = {
  draft: { variant: 'neutral', label: '임시저장' },
  pending: { variant: 'warning', label: '승인대기' },
  approved: { variant: 'success', label: '승인' },
  rejected: { variant: 'danger', label: '반려' },
  recalled: { variant: 'info', label: '회수' },
  cancelled: { variant: 'neutral', label: '취소' },
};

const StatusBadge = ({ status, size = 'md' }) => {
  const config = STATUS_CONFIG[status] || { variant: 'neutral', label: status };
  return (
    <Badge variant={config.variant} size={size}>
      {config.label}
    </Badge>
  );
};

export default StatusBadge;

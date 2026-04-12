import React from 'react';

const Badge = ({ variant = 'neutral', size = 'md', children }) => {
  const className = `badge badge--${size} badge--${variant}`;
  return <span className={className}>{children}</span>;
};

export default Badge;

import React from 'react';

const GuideCard = ({
  icon = '\uD83D\uDCCC',
  title,
  children,
  onAction,
  actionLabel,
}) => {
  return (
    <div className="guide-card">
      <span className="guide-card__icon">{icon}</span>
      <div className="guide-card__content">
        {title && <div className="guide-card__title">{title}</div>}
        <div className="guide-card__body">{children}</div>
        {onAction && actionLabel && (
          <div className="guide-card__action">
            <button className="btn btn--primary btn--sm" onClick={onAction}>
              {actionLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default GuideCard;

import React from 'react';

const ApprovalDots = ({ steps = [], currentStep = 0 }) => {
  return (
    <div className="approval-dots">
      {steps.map((step, idx) => {
        let dotStatus;
        if (step.status === 'approved') dotStatus = 'approved';
        else if (step.status === 'rejected') dotStatus = 'rejected';
        else if (idx === currentStep) dotStatus = 'current';
        else dotStatus = 'pending';

        return (
          <div className="approval-dots__step" key={idx}>
            {idx > 0 && (
              <div
                className={`approval-dots__line ${
                  steps[idx - 1]?.status === 'approved' ? 'approval-dots__line--done' : ''
                }`}
              />
            )}
            <div
              className={`approval-dots__dot approval-dots__dot--${dotStatus}`}
              title={`${step.assigneeName || ''} (${step.stepType || ''})`}
            />
          </div>
        );
      })}
    </div>
  );
};

export default ApprovalDots;

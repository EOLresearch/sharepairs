import React from 'react';

export default function ToggleSwitch({ isOn, handleToggle }) {
  const confirmToggle = () => {
    const action = isOn ? 'disable' : 'enable';
    const confirmed = window.confirm(`Are you sure you want to ${action} chat for this user?`);
    if (confirmed) {
      handleToggle();
    }
  };

  return (
    <div
      className={`toggle-switch ${isOn ? 'on' : 'off'}`}
      onClick={confirmToggle}
      role="switch"
      aria-checked={isOn}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') confirmToggle();
      }}
    >
      <div className="toggle-knob" />
    </div>
  );
}
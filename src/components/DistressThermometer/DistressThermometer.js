import React, { useState } from 'react';
import HoverTooltip from '../HoverToolTip/HoverToolTip';
import en from '../../translations/en';
import tr from '../../translations/tr';

const DistressThermometer = ({ language, setShowDistressThermometer, handleDistressSelection }) => {
  const [selectedValue, setSelectedValue] = useState(null);
  const t = language === 'tr' ? tr : en;

  const values = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 0];

  const handleSelection = (value) => {
    setSelectedValue(value);
    handleDistressSelection(value);
  };

  return (
    <div className="distress-thermometer-wrapper">
      <h2>{t.distress.title}</h2>
      <p>{t.distress.instructions}</p>
      <div className="thermometer-container">
        <div className="descriptions">
          {values.map(value => (
            <div
              key={value}
              className={`description ${selectedValue === value ? 'active' : ''}`}
              onClick={() => handleSelection(value)}
              onMouseEnter={() => setSelectedValue(value)}
            >
              {t.distress.levels[value]}
            </div>
          ))}
        </div>
        <div className="tick-wrapper">
          {values.map(value => (
            <div key={value} className="tick-container">
              <div className="tick-number">{value}</div>
              <div className={`tick ${selectedValue === value ? 'active' : ''}`} />
            </div>
          ))}
        </div>
        <div className="thermometer">
          <div className='thermometer-base' />
        </div>
      </div>
    </div>
  );
};

export default DistressThermometer;

import React from 'react';
import PropTypes from 'prop-types';

export default function IntakeSurvey({
  inq,
  cssrs,
  inqResponses,
  cssrsIntake,
  onInqChange,
  onCssrsChange,
}) {
  return (
    <div className="intake-survey">
      {inq?.description ? <p className="intake-instructions">{inq.description}</p> : null}
      {(inq?.items || []).map((item) => {
        const options = item.options || [];
        const wide = options.length > 2;
        return (
        <fieldset key={item.id} className="intake-item">
          <legend>{item.text}</legend>
          <div className={`intake-scale${wide ? ' is-wide' : ''}`} role="radiogroup" aria-label={item.text}>
            {options.map((opt) => (
              <label key={opt.value} className="intake-choice" aria-label={opt.label}>
                <input
                  type="radio"
                  name={item.id}
                  value={opt.value}
                  aria-label={opt.label}
                  checked={String(inqResponses?.[item.id] || '') === String(opt.value)}
                  onChange={() => onInqChange(item.id, opt.value)}
                />
                <span>{wide ? opt.value : opt.label}</span>
              </label>
            ))}
          </div>
          {wide && options.length ? (
            <div className="intake-anchors">
              <span>{options[0].label}</span>
              <span>{options[options.length - 1].label}</span>
            </div>
          ) : null}
        </fieldset>
        );
      })}

      {(cssrs?.items || []).map((item) => (
        <fieldset key={item.id} className="intake-item">
          <legend>{item.text}</legend>
          <div className="intake-scale" role="radiogroup" aria-label={item.text}>
            {(item.options || []).map((opt) => (
              <label key={opt.value} className="intake-choice">
                <input
                  type="radio"
                  name="cssrsIntake"
                  value={opt.value}
                  checked={cssrsIntake === opt.value}
                  onChange={() => onCssrsChange(opt.value)}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

IntakeSurvey.propTypes = {
  inq: PropTypes.object,
  cssrs: PropTypes.object,
  inqResponses: PropTypes.object,
  cssrsIntake: PropTypes.string,
  onInqChange: PropTypes.func.isRequired,
  onCssrsChange: PropTypes.func.isRequired,
};

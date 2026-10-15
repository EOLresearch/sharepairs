import PropTypes from 'prop-types';

function SelectField({
  label,
  name,
  placeholder,
  id,
  value,
  onChange,
  options,
  hint,
  visibleToPartner,
  partnerBadge,
}) {
  return (
    <div className="field-block">
      {label && (
        <label htmlFor={id}>
          {label}
          {visibleToPartner && partnerBadge ? (
            <span className="partner-visible-tag">{partnerBadge}</span>
          ) : null}
        </label>
      )}
      {hint ? <p className="field-hint">{hint}</p> : null}
      <div className="input-container">
        <select name={name} id={id} placeholder={placeholder} value={value} onChange={onChange}>
        <option value="" disabled>Please select an option.</option>
          {options.map(option => 
            <option key={option} value={option}>{option}</option>
          )}
        </select>
      </div>
    </div>
  );
}

SelectField.propTypes = {
  label: PropTypes.string,
  name: PropTypes.string.isRequired,
  placeholder: PropTypes.string,
  id: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(PropTypes.string).isRequired,
  hint: PropTypes.string,
  visibleToPartner: PropTypes.bool,
  partnerBadge: PropTypes.string,
};

SelectField.defaultProps = {
  label: null,
  placeholder: '',
  hint: null,
  visibleToPartner: false,
  partnerBadge: '',
};

export default SelectField;

import PropTypes from 'prop-types';

function SelectField({ label, name, placeholder, id, value, onChange, options }) {
  return (
    <>
      {label && <label htmlFor={id}>{label}</label>}
      <div className='input-container'>
        <select name={name} id={id} placeholder={placeholder} value={value} onChange={onChange}>
        <option value="" disabled>Please select an option.</option>
          {options.map(option => 
            <option key={option} value={option}>{option}</option>
          )}
        </select>
      </div>
    </>
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
};

SelectField.defaultProps = {
  label: null,
  placeholder: '',
};

export default SelectField;

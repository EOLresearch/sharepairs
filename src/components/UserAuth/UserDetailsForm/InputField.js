function InputField({ type, name, placeholder, id, value, iconClass, onChange, label }) {
  return (
    <>
    {label && <label htmlFor={id}>{label}</label>}
    <div className='input-container'>
      {iconClass && <i className={iconClass}></i>}
      <input type={type} name={name} placeholder={placeholder} id={id} value={value} onChange={onChange} />
    </div>
    </>
  );
}

export default InputField;
function InputField({
  type,
  name,
  placeholder,
  id,
  value,
  iconClass,
  icon,
  onChange,
  label,
  disabled,
  visibleToPartner,
  partnerBadge,
  hint,
  autoComplete,
}) {
  const isTextArea = type === 'textarea';
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
    <div className={`input-container${disabled ? ' is-disabled' : ''}`}>
      {icon || (iconClass ? <i className={iconClass} aria-hidden="true" /> : null)}
      {isTextArea ? (
        <textarea name={name} placeholder={placeholder} id={id} value={value} onChange={onChange || (() => {})} rows={4} disabled={disabled} readOnly={disabled} />
      ) : (
        <input type={type} name={name} placeholder={placeholder} id={id} value={value} onChange={onChange || (() => {})} disabled={disabled} readOnly={disabled} autoComplete={autoComplete} />
      )}
    </div>
    </div>
  );
}

export default InputField;
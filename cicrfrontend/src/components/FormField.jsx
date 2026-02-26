export default function FormField({
  id,
  label,
  required = false,
  optional = false,
  hint = '',
  error = '',
  className = '',
  children,
}) {
  return (
    <div className={`ui-field ${className}`}>
      {label ? (
        <label htmlFor={id} className="ui-label">
          <span>{label}</span>
          {required ? <span className="ui-label-required">Required</span> : null}
          {!required && optional ? <span className="ui-label-optional">Optional</span> : null}
        </label>
      ) : null}
      {children}
      {error ? <p className="ui-field-error">{error}</p> : hint ? <p className="ui-field-hint">{hint}</p> : null}
    </div>
  );
}

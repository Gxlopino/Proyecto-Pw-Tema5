// src/widgets/FormField.jsx
// Campo de formulario con etiqueta, ayuda y error junto al campo.
import React from 'react';

export function inputClass(error, base = 'form-control') {
  return `${base} ${error ? 'is-invalid' : ''}`;
}

export default function FormField({ id, label, error, hint, valid, className = 'mb-3', children }) {
  return (
    <div className={className}>
      {label && <label className="form-label" htmlFor={id}>{label}</label>}
      {children}
      {error ? <div className="invalid-feedback d-block">{error}</div> : valid ? <div className="valid-feedback d-block">{valid}</div> : hint ? <div className="form-text">{hint}</div> : null}
    </div>
  );
}

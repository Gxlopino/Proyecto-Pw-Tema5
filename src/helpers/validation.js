// src/helpers/validation.js
// Reglas compartidas por los formularios (se repetirán en el servidor en la Entrega 2).
export const EMAIL_INSTITUCIONAL = /^[a-z0-9._-]+@(aloe\.)?ulima\.edu\.pe$/i;

export function validarPassword(password) {
  if (!password) return 'La contraseña es obligatoria.';
  if (password.length < 8) return 'Mínimo 8 caracteres, con una mayúscula y un número.';
  if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) return 'Mínimo 8 caracteres, con una mayúscula y un número.';
  return null;
}

export function validarTelefono(telefono) {
  if (!telefono) return 'El teléfono es obligatorio.';
  if (!/^9\d{2}\s?\d{3}\s?\d{3}$/.test(telefono.trim())) return 'Ingresa un celular de 9 dígitos que empiece con 9.';
  return null;
}

/** 0 a 3 según la fuerza de la contraseña */
export function fuerzaPassword(password = '') {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password) && /[0-9]/.test(password)) score++;
  if (password.length >= 12 || /[^A-Za-z0-9]/.test(password)) score++;
  return score;
}

// src/helpers/navigation.js
// Cada SideBar<Rol> tiene su propio menú; aquí solo queda lo común a todas las mini-apps.

export const ROLES = {
  usuario: 'Usuario',
  tecnico: 'Técnico',
  supervisor: 'Supervisor',
};

/** Vista inicial de cada rol (la misma que usa el servidor en configs/helpers.js) */
export function rutaInicio(rol) {
  if (rol === 'tecnico') return '/tecnico/bandeja';
  if (rol === 'supervisor') return '/supervisor/cola';
  return '/usuario/tickets';
}

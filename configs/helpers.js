// configs/helpers.js

/** Vista inicial de cada rol después de iniciar sesión */
export function rutaInicio(role) {
  if (role === 'tecnico') return '/tecnico/bandeja';
  if (role === 'supervisor') return '/supervisor/cola';
  return '/usuario/tickets';
}

export function hasRole(session, roleName) {
  if (!session || !Array.isArray(session.roles)) {
    return false;
  }

  return session.roles.some(role =>
    role?.name?.toLowerCase() === roleName?.toLowerCase()
  );
}

export function roleHasPermission(session, roleName, permissionName) {
  if (!session?.roles?.length || !roleName || !permissionName) {
    return false;
  }

  const normalizedRole = roleName.trim().toLowerCase();
  const normalizedPermission = permissionName.trim().toLowerCase();

  const role = session.roles.find(r =>
    r?.name?.trim().toLowerCase() === normalizedRole
  );

  if (!role?.permissions?.length) {
    return false;
  }

  return role.permissions.some(permission =>
    permission?.name?.trim().toLowerCase() === normalizedPermission
  );
}

// configs/middlewares.js

import { hasRole, roleHasPermission, rutaInicio } from '../configs/helpers.js';
import { obtenerUsuarioSesion } from '../website/services/cuenta_services.js';

/**
 * Middleware para manejar errores 404
 * Si es una petición API (empieza con /api) devuelve JSON
 * Si es una petición web normal devuelve la vista 404
 */
export function notFoundHandler(req, res) {
  // Verificar si es una petición a la API
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      success: false,
      message: 'Recurso no encontrado',
      data: null,
      error: 'Error 404'
    });
  }

  // Para peticiones no-API (y solo GET) renderizar vista 404
  if (req.method === 'GET') {
    return res.status(404).render('404', {
      title: 'Página no encontrada',
      message: 'La página que buscas no existe.'
    });
  }

  // Para otros métodos HTTP en rutas no-API
  return res.status(404).json({
    success: false,
    message: 'Recurso no encontrado',
    data: null,
    error: 'Error 404'
  });
}

/**
 * Middleware para manejo de errores generales
 * (Opcional - puedes expandirlo según necesites)
 */
export function errorHandler(err, req, res, next) {
  console.error('Error:', err.stack || err);

  // Determinar si es una petición API
  const isApiRequest = req.path.startsWith('/api/');

  const statusCode = err.statusCode || 500;

  if (isApiRequest) {
    return res.status(statusCode).json({
      success: false,
      message: err.message || 'Error interno del servidor',
      data: null,
      error: `Error ${statusCode}`
    });
  }

  // Para peticiones web
  res.status(statusCode).render('error', {
    title: 'Error',
    message: err.message || 'Ha ocurrido un error inesperado.',
    statusCode: statusCode
  });
}

/**
 * 401 · sin sesión: JSON si es una petición a la API, vista 401 si es una página.
 */
function noAutorizado(req, res, message) {
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(401).json({
      success: false,
      message,
      data: null,
      error: 'Error 401'
    });
  }

  return res.status(401).render('401', {
    title: 'Debes iniciar sesión',
    message,
    statusCode: 401
  });
}

const NOMBRE_ROL = { usuario: 'usuario', tecnico: 'técnico', supervisor: 'supervisor' };

// Qué zonas son exclusivas de cada rol (texto de la vista 403)
const EXCLUSIVO_DE = {
  usuario: 'El registro y el seguimiento de tickets propios son exclusivos de los usuarios solicitantes.',
  tecnico: 'La bandeja y la atención de tickets asignados son exclusivas de los técnicos.',
  supervisor: 'La cola, la asignación y el catálogo de servicios son exclusivos del supervisor.',
};

/** Nombre de la zona a la que quiso entrar, a partir de la ruta (vista 403) */
function nombreSeccion(path) {
  const secciones = [
    [/^\/supervisor\/cola/, 'la cola de atención'],
    [/^\/supervisor\/bandejas/, 'las bandejas de los técnicos'],
    [/^\/supervisor\/categorias/, 'el catálogo de servicios'],
    [/^\/supervisor\/ambientes/, 'los ambientes del catálogo'],
    [/^\/supervisor\/tecnicos-categoria/, 'la asignación de técnicos por categoría'],
    [/^\/supervisor\/tickets/, 'la atención de tickets del supervisor'],
    [/^\/supervisor/, 'el panel del supervisor'],
    [/^\/tecnico\/bandeja/, 'la bandeja del técnico'],
    [/^\/tecnico\/tickets/, 'la atención de tickets del técnico'],
    [/^\/tecnico/, 'el panel del técnico'],
    [/^\/usuario\/tickets\/nuevo/, 'el registro de tickets'],
    [/^\/usuario\/tickets/, 'los tickets del usuario'],
    [/^\/usuario/, 'el panel del usuario'],
  ];
  const encontrada = secciones.find(([patron]) => patron.test(path));
  return encontrada ? encontrada[1] : 'esta sección';
}

/**
 * 403 · hay sesión pero con otro rol: JSON si es una petición a la API, vista 403 si es una página.
 */
function prohibido(req, res, rolRequerido) {
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(403).json({
      success: false,
      message: `Debes ser ${NOMBRE_ROL[rolRequerido]}`,
      data: null,
      error: 'Error 403'
    });
  }

  const usuario = obtenerUsuarioSesion(req.session.userId);
  return res.status(403).render('403', {
    title: 'Acceso denegado',
    seccion: nombreSeccion(req.path),
    rol: NOMBRE_ROL[req.session.role] || req.session.role,
    exclusivo: EXCLUSIVO_DE[rolRequerido],
    nombre: usuario ? `${usuario.nombres} ${usuario.apellidos}` : req.session.username,
    statusCode: 403
  });
}

function estaLogueado(req) {
  return !!(req.session && req.session.userId && req.session.role);
}

/** Sin sesión → 401; con sesión de otro rol → 403 */
function soloRol(rol) {
  return (req, res, next) => {
    if (!estaLogueado(req)) {
      return noAutorizado(req, res, 'Debes estar logueado');
    }
    if (req.session.role !== rol) {
      return prohibido(req, res, rol);
    }
    next();
  };
}

export function soloLogueado(req, res, next) {
  if (!estaLogueado(req)) {
    return noAutorizado(req, res, 'Debes estar logueado');
  }
  next();
}

export const soloUsuario = soloRol('usuario');
export const soloTecnico = soloRol('tecnico');
export const soloSupervisor = soloRol('supervisor');

/**
 * Si ya hay sesión y entra a /login o /registro, lo manda a la vista inicial de su rol
 */
export function redireccionarSiLogueado(req, res, next) {
  if (estaLogueado(req)) {
    return res.redirect(rutaInicio(req.session.role));
  }
  next();
}

export function viewFlash(req, res, next) {
  res.locals.successMessage = req.flash('success');
  res.locals.errorMessage = req.flash('error');
  next();
}

export function viewSession(req, res, next) {
  res.locals.session = req.session;
  res.locals.username = req.session?.username || null;
  res.locals.role = req.session?.role || null;
  res.locals.isAuthenticated = estaLogueado(req);
  res.locals.rutaInicio = res.locals.isAuthenticated ? rutaInicio(req.session.role) : '/login';

  next();
}

export function viewEnv(req, res, next) {
  res.locals.BASE_URL = process.env.BASE_URL || '/';
  res.locals.STATIC_URL = process.env.STATIC_URL || '/';
  res.locals.FILES_URL = process.env.URL_FILES_SERVICE || '/';
  res.locals.ACCESS_URL = process.env.URL_ACCESS_SERVICE || '/';

  next();
}

export function viewHelpers(req, res, next) {
  res.locals.hasRole = (roleName) =>
    hasRole(req.session, roleName);
  res.locals.roleHasPermission = (role, permission) =>
    roleHasPermission(req.session, role, permission);

  next();
}

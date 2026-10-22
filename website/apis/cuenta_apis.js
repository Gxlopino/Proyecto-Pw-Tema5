// website/apis/cuenta_apis.js
// HU-1 · APIs de cuenta. Respuesta: { success, message, data, error }.
// En errores de validación (400) "error" trae los mensajes por campo: { campo: mensaje }.
import * as service from '../services/cuenta_services.js';

function ok(res, status, message, data) {
  return res.status(status).json({ success: true, message, data, error: null });
}

function fallo(res, error) {
  const status = error.status || 500;
  if (status === 500) console.error(error.stack);
  return res.status(status).json({
    success: false,
    message: status === 500 ? 'Error interno del servidor' : error.message,
    data: null,
    error: error.errores || `Error ${status}`,
  });
}

/** Registro y alta por invitación dejan la sesión iniciada */
function iniciarSesion(req, usuario, callback) {
  req.session.userId = usuario.id;
  req.session.username = usuario.email;
  req.session.role = usuario.rol;
  req.session.save(callback);
}

// GET /api/v1/sessions
export function sessionInfo(req, res) {
  const usuario = service.obtenerUsuarioSesion(req.session.userId);
  if (!usuario) {
    return res.status(401).json({
      success: false,
      message: 'Debes estar logueado',
      data: null,
      error: 'SESSION_NOT_FOUND'
    });
  }
  return ok(res, 200, 'Sesión activa', usuario);
}

// GET /api/v1/unidades
export function listarUnidades(req, res) {
  return ok(res, 200, 'Unidades listadas', service.listarUnidades());
}

// GET /api/v1/registro/disponible?email=
export function emailDisponible(req, res) {
  return ok(res, 200, 'Disponibilidad del correo', { disponible: service.emailDisponible(req.query.email) });
}

// POST /api/v1/registro
export function registrar(req, res) {
  try {
    const usuario = service.registrar(req.body);
    iniciarSesion(req, usuario, () => ok(res, 201, 'Cuenta creada', usuario));
  } catch (error) {
    return fallo(res, error);
  }
}

// GET /api/v1/invitaciones/:token
export function obtenerInvitacion(req, res) {
  try {
    return ok(res, 200, 'Invitación encontrada', service.obtenerInvitacion(req.params.token));
  } catch (error) {
    return fallo(res, error);
  }
}

// POST /api/v1/invitaciones/:token/aceptar
export function aceptarInvitacion(req, res) {
  try {
    const usuario = service.aceptarInvitacion(req.params.token, req.body);
    iniciarSesion(req, usuario, () => ok(res, 201, 'Cuenta activada', usuario));
  } catch (error) {
    return fallo(res, error);
  }
}

// POST /api/v1/invitaciones/:token/rechazar
export function rechazarInvitacion(req, res) {
  try {
    service.rechazarInvitacion(req.params.token);
    return ok(res, 200, 'Invitación rechazada', true);
  } catch (error) {
    return fallo(res, error);
  }
}

// POST /api/v1/invitaciones (solo supervisor)
export function crearInvitacion(req, res) {
  try {
    return ok(res, 201, 'Invitación creada', service.crearInvitacion(req.body, req.session.userId));
  } catch (error) {
    return fallo(res, error);
  }
}

// POST /api/v1/recuperar
export function solicitarRecuperacion(req, res) {
  try {
    return ok(res, 200, 'Enlace de recuperación generado', service.solicitarRecuperacion(req.body.email));
  } catch (error) {
    return fallo(res, error);
  }
}

// GET /api/v1/recuperar/:token
export function validarTokenRecuperacion(req, res) {
  try {
    return ok(res, 200, 'Enlace válido', service.validarTokenRecuperacion(req.params.token));
  } catch (error) {
    return fallo(res, error);
  }
}

// POST /api/v1/restablecer
export function restablecerPassword(req, res) {
  try {
    const { token, password, confirmar } = req.body;
    return ok(res, 200, 'Contraseña actualizada', service.restablecerPassword(token, password, confirmar));
  } catch (error) {
    return fallo(res, error);
  }
}

// PUT /api/v1/cuenta
export function actualizarCuenta(req, res) {
  try {
    return ok(res, 200, 'Datos actualizados', service.actualizarCuenta(req.session.userId, req.body));
  } catch (error) {
    return fallo(res, error);
  }
}

// PUT /api/v1/cuenta/password
export function cambiarPassword(req, res) {
  try {
    return ok(res, 200, 'Contraseña actualizada', service.cambiarPassword(req.session.userId, req.body));
  } catch (error) {
    return fallo(res, error);
  }
}
// website/services/cuenta_services.js
// HU-1 · Cuenta y acceso. Reglas de negocio (las mismas validaciones que el front).
// No toca req/res ni los datos directamente: todo pasa por cuenta_repositories.js.
import crypto from 'crypto';
import * as repo from '../repositories/cuenta_repositories.js';

const MAX_INTENTOS = 5;
const MINUTOS_BLOQUEO = 15;
const MINUTOS_RECUPERACION = 30;
const DIAS_INVITACION = 7;
const MAX_ESPECIALIDADES = 3;

const EMAIL_INSTITUCIONAL = /^[a-z0-9._-]+@(aloe\.)?ulima\.edu\.pe$/i;
const EMAIL_PERSONAL = /@ulima\.edu\.pe$/i;

/** Error de negocio con su código HTTP (400, 401, 403, 404, 409) y errores por campo */
export class ServiceError extends Error {
  constructor(message, status = 400, errores = null) {
    super(message);
    this.status = status;
    this.errores = errores;
  }
}

// ---------- Utilidades ----------
/** Nunca se expone la contraseña fuera del servidor */
export function sinPassword(usuario) {
  if (!usuario) return null;
  const { password, ...resto } = usuario;
  return resto;
}

function nombreCompleto(usuario) {
  if (!usuario) return '—';
  return `${usuario.nombres.split(' ')[0]} ${usuario.apellidos}`;
}

function token(longitud) {
  return crypto.randomBytes(longitud).toString('hex').slice(0, longitud);
}

function validarPassword(password) {
  if (!password) return 'La contraseña es obligatoria.';
  if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Mínimo 8 caracteres, con una mayúscula y un número.';
  }
  return null;
}

function validarTelefono(telefono) {
  if (!telefono) return 'El teléfono es obligatorio.';
  if (!/^9\d{2}\s?\d{3}\s?\d{3}$/.test(String(telefono).trim())) return 'Ingresa un celular de 9 dígitos que empiece con 9.';
  return null;
}

function revisar(errores) {
  if (Object.keys(errores).length) throw new ServiceError('Revisa los campos marcados.', 400, errores);
}

// ---------- Inicio de sesión ----------
/** Devuelve el usuario (sin contraseña) o lanza ServiceError. Bloquea 15 min tras 5 intentos fallidos. */
export function login(email, password) {
  const correo = (email || '').trim().toLowerCase();
  if (!correo || !password) throw new ServiceError('Ingresa tu correo y tu contraseña.', 400);

  const registro = repo.leerIntentos(correo);
  if (registro.bloqueadoHasta && new Date(registro.bloqueadoHasta) > new Date()) {
    throw Object.assign(new ServiceError('Cuenta bloqueada temporalmente.', 403), { bloqueadoHasta: registro.bloqueadoHasta });
  }

  const usuario = repo.buscarUsuarioPorEmail(correo);
  if (!usuario || usuario.password !== password) {
    registro.fallidos += 1;
    registro.bloqueadoHasta = null;
    if (registro.fallidos >= MAX_INTENTOS) {
      registro.bloqueadoHasta = new Date(Date.now() + MINUTOS_BLOQUEO * 60000).toISOString();
      registro.fallidos = 0;
    }
    repo.guardarIntentos(correo, registro);
    if (registro.bloqueadoHasta) {
      throw Object.assign(new ServiceError('Cuenta bloqueada temporalmente.', 403), { bloqueadoHasta: registro.bloqueadoHasta });
    }
    throw Object.assign(new ServiceError('Correo o contraseña incorrectos.', 401), { restantes: MAX_INTENTOS - registro.fallidos });
  }

  if (usuario.estado === 'bloqueado') throw new ServiceError('Tu cuenta está bloqueada. Escribe a soporte.campus@ulima.edu.pe.', 403);
  if (usuario.estado === 'inactivo') throw new ServiceError('Tu cuenta está inactiva. Escribe a soporte.campus@ulima.edu.pe.', 403);

  repo.borrarIntentos(correo);
  return sinPassword(repo.actualizarUsuario(usuario.id, { ultimoAcceso: new Date().toISOString() }));
}

/** Usuario de la sesión (o null si ya no existe o dejó de estar activo) */
export function obtenerUsuarioSesion(userId) {
  const usuario = repo.buscarUsuarioPorId(userId);
  if (!usuario || usuario.estado !== 'activo') return null;
  return sinPassword(usuario);
}

// ---------- Registro ----------
export function listarUnidades() {
  return repo.listarUnidades();
}

export function emailDisponible(email) {
  return !repo.buscarUsuarioPorEmail(email);
}

export function registrar(data = {}) {
  const errores = {};
  if (!data.nombres?.trim()) errores.nombres = 'Los nombres son obligatorios.';
  if (!data.apellidos?.trim()) errores.apellidos = 'Los apellidos son obligatorios.';
  if (!data.email?.trim()) errores.email = 'El correo es obligatorio.';
  else if (!EMAIL_INSTITUCIONAL.test(data.email.trim())) errores.email = 'Usa tu correo institucional (@ulima.edu.pe o @aloe.ulima.edu.pe).';
  const tel = validarTelefono(data.telefono); if (tel) errores.telefono = tel;
  const pass = validarPassword(data.password); if (pass) errores.password = pass;
  if (data.password !== data.confirmar) errores.confirmar = 'Las contraseñas no coinciden.';
  if (!data.unidad) errores.unidad = 'Selecciona tu unidad o carrera.';
  else if (!repo.listarUnidades().includes(data.unidad)) errores.unidad = 'Selecciona una unidad de la lista.';
  if (!data.vinculo) errores.vinculo = 'Selecciona tu vínculo con la universidad.';
  if (!data.terminos) errores.terminos = 'Debes aceptar los términos del servicio.';
  revisar(errores);
  if (!emailDisponible(data.email)) {
    throw new ServiceError('Ese correo ya tiene una cuenta.', 409, { email: 'Ese correo ya tiene una cuenta.' });
  }

  const ahora = new Date().toISOString();
  return sinPassword(repo.crearUsuario({
    nombres: data.nombres.trim(),
    apellidos: data.apellidos.trim(),
    email: data.email.trim().toLowerCase(),
    password: data.password,
    telefono: data.telefono.trim(),
    unidad: data.unidad,
    vinculo: data.vinculo,
    rol: 'usuario',
    estado: 'activo',
    motivoBloqueo: null,
    especialidades: [],
    ambienteHabitualId: null,
    creadoEn: ahora,
    ultimoAcceso: ahora,
  }));
}

// ---------- Invitaciones (técnicos y supervisores) ----------
function invitacionExistente(tokenInvitacion) {
  const inv = repo.buscarInvitacionPorToken(tokenInvitacion);
  if (!inv) throw new ServiceError('La invitación no existe.', 404);
  return inv;
}

export function obtenerInvitacion(tokenInvitacion) {
  const inv = invitacionExistente(tokenInvitacion);
  const invitadoPor = repo.buscarUsuarioPorId(inv.invitadoPorId);
  return { ...inv, vencida: new Date(inv.venceEn) < new Date(), invitadoPor: nombreCompleto(invitadoPor) };
}

export function aceptarInvitacion(tokenInvitacion, { password, confirmar, telefono, especialidades } = {}) {
  const inv = invitacionExistente(tokenInvitacion);
  if (inv.estado !== 'pendiente') throw new ServiceError('Esta invitación ya fue usada o rechazada.', 409);
  if (new Date(inv.venceEn) < new Date()) throw new ServiceError('La invitación venció. Pide una nueva a Infraestructura.', 409);

  const lista = Array.isArray(especialidades) ? especialidades.map(Number) : [];
  const categorias = repo.listarCategorias().filter((c) => c.parentId === null).map((c) => c.id);
  const errores = {};
  const pass = validarPassword(password); if (pass) errores.password = pass;
  if (password !== confirmar) errores.confirmar = 'Las contraseñas no coinciden.';
  const tel = validarTelefono(telefono); if (tel) errores.telefono = tel;
  if (inv.rol === 'tecnico' && lista.length === 0) errores.especialidades = 'Elige al menos una categoría.';
  if (lista.length > MAX_ESPECIALIDADES) errores.especialidades = 'Puedes elegir hasta tres categorías.';
  else if (lista.some((id) => !categorias.includes(id))) errores.especialidades = 'Elige categorías de la lista.';
  revisar(errores);
  if (!emailDisponible(inv.email)) throw new ServiceError('Ese correo ya tiene una cuenta.', 409);

  const ahora = new Date().toISOString();
  const nuevo = repo.crearUsuario({
    nombres: inv.nombres,
    apellidos: inv.apellidos,
    email: inv.email,
    password,
    telefono: String(telefono).trim(),
    unidad: 'Infraestructura y Servicios',
    vinculo: 'administrativo',
    rol: inv.rol,
    estado: 'activo',
    motivoBloqueo: null,
    especialidades: inv.rol === 'tecnico' ? lista : [],
    ambienteHabitualId: null,
    creadoEn: ahora,
    ultimoAcceso: ahora,
  });
  repo.actualizarInvitacion(tokenInvitacion, { estado: 'aceptada' });
  return sinPassword(nuevo);
}

export function rechazarInvitacion(tokenInvitacion) {
  const inv = invitacionExistente(tokenInvitacion);
  if (inv.estado !== 'pendiente') throw new ServiceError('Esta invitación ya fue usada o rechazada.', 409);
  repo.actualizarInvitacion(tokenInvitacion, { estado: 'rechazada' });
  return true;
}

/** Usada por el supervisor (HU-2 · Técnicos por categoría) para invitar personal */
export function crearInvitacion(data = {}, invitadoPorId) {
  const errores = {};
  if (!data.nombres?.trim()) errores.nombres = 'Los nombres son obligatorios.';
  if (!data.apellidos?.trim()) errores.apellidos = 'Los apellidos son obligatorios.';
  if (!data.email?.trim() || !EMAIL_PERSONAL.test(data.email.trim())) errores.email = 'Usa un correo @ulima.edu.pe.';
  else if (!emailDisponible(data.email)) errores.email = 'Ese correo ya tiene una cuenta.';
  if (!['tecnico', 'supervisor'].includes(data.rol)) errores.rol = 'Selecciona el rol.';
  revisar(errores);

  return repo.crearInvitacion({
    token: `inv-${data.rol.slice(0, 3)}-${token(6)}`,
    nombres: data.nombres.trim(),
    apellidos: data.apellidos.trim(),
    email: data.email.trim().toLowerCase(),
    rol: data.rol,
    telefono: data.telefono || '',
    invitadoPorId,
    creadoEn: new Date().toISOString(),
    venceEn: new Date(Date.now() + DIAS_INVITACION * 86400000).toISOString(),
    estado: 'pendiente',
  });
}

// ---------- Recuperación de contraseña ----------
export function solicitarRecuperacion(email) {
  const correo = (email || '').trim().toLowerCase();
  if (!EMAIL_INSTITUCIONAL.test(correo)) {
    throw new ServiceError('Ingresa un correo institucional válido.', 400, { email: 'Ingresa un correo institucional válido.' });
  }
  const usuario = repo.buscarUsuarioPorEmail(correo);
  // Por seguridad la respuesta es la misma exista o no la cuenta.
  let enlace = null;
  if (usuario) {
    const rec = repo.crearRecuperacion({
      usuarioId: usuario.id,
      token: token(24),
      venceEn: new Date(Date.now() + MINUTOS_RECUPERACION * 60000).toISOString(),
      usado: false,
    });
    enlace = `/recuperar?token=${rec.token}`;
  }
  // No se envían correos reales (fuera de alcance): se devuelve el enlace para mostrarlo en pantalla.
  return { email: correo, enlace };
}

function recuperacionVigente(tokenRecuperacion) {
  const rec = repo.buscarRecuperacionPorToken(tokenRecuperacion);
  if (!rec || rec.usado || new Date(rec.venceEn) < new Date()) throw new ServiceError('El enlace no es válido o ya venció.', 404);
  return rec;
}

export function validarTokenRecuperacion(tokenRecuperacion) {
  recuperacionVigente(tokenRecuperacion);
  return true;
}

export function restablecerPassword(tokenRecuperacion, password, confirmar) {
  const errores = {};
  const pass = validarPassword(password); if (pass) errores.password = pass;
  if (password !== confirmar) errores.confirmar = 'Las contraseñas no coinciden.';
  revisar(errores);

  const rec = recuperacionVigente(tokenRecuperacion);
  repo.actualizarUsuario(rec.usuarioId, { password });
  repo.marcarRecuperacionUsada(tokenRecuperacion);
  const usuario = repo.buscarUsuarioPorId(rec.usuarioId);
  repo.borrarIntentos(usuario.email.toLowerCase());
  return true;
}

// ---------- Mi cuenta ----------
export function actualizarCuenta(id, data = {}) {
  const errores = {};
  if (!data.nombres?.trim()) errores.nombres = 'Los nombres son obligatorios.';
  if (!data.apellidos?.trim()) errores.apellidos = 'Los apellidos son obligatorios.';
  const tel = validarTelefono(data.telefono); if (tel) errores.telefono = tel;
  revisar(errores);

  const usuario = repo.buscarUsuarioPorId(id);
  if (!usuario) throw new ServiceError('La cuenta no existe.', 404);
  return sinPassword(repo.actualizarUsuario(id, {
    nombres: data.nombres.trim(),
    apellidos: data.apellidos.trim(),
    telefono: data.telefono.trim(),
    unidad: data.unidad || usuario.unidad,
    ambienteHabitualId: data.ambienteHabitualId ? Number(data.ambienteHabitualId) : null,
  }));
}

export function cambiarPassword(id, { actual, nueva, confirmar } = {}) {
  const usuario = repo.buscarUsuarioPorId(id);
  if (!usuario) throw new ServiceError('La cuenta no existe.', 404);
  const errores = {};
  if (!actual) errores.actual = 'Ingresa tu contraseña actual.';
  else if (usuario.password !== actual) errores.actual = 'La contraseña actual no es correcta.';
  const pass = validarPassword(nueva); if (pass) errores.nueva = pass;
  if (nueva && nueva === actual) errores.nueva = 'La nueva contraseña debe ser distinta a la actual.';
  if (nueva !== confirmar) errores.confirmar = 'Las contraseñas no coinciden.';
  revisar(errores);
  repo.actualizarUsuario(id, { password: nueva });
  return true;
}

// ---------- Landing (1.1) ----------
/** Categorías activas con sus subcategorías activas */
export function categoriasLanding() {
  const categorias = repo.listarCategorias();
  return categorias
    .filter((c) => c.parentId === null && c.activa)
    .map((c) => ({ ...c, subcategorias: categorias.filter((s) => s.parentId === c.id && s.activa) }));
}

export function prioridadesLanding() {
  return repo.listarPrioridades();
}

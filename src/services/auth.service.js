// src/services/auth.service.js
// HU-1 · Cuenta y acceso. El login y la sesión se validan en el servidor (POST /login, GET /api/v1/sessions);
// registro, invitaciones, recuperación y mi cuenta llaman a las APIs de website/apis/cuenta_apis.js.
// Las lecturas de usuarios para otras historias (nombres, técnicos) siguen sobre el seed local.
import { getTable, saveTable, apiGet, apiPost, apiPut } from './api.client';
import { EMAIL_INSTITUCIONAL, validarPassword, validarTelefono } from '../helpers/validation';

/** Nunca se expone la contraseña fuera del service */
export function sinPassword(usuario) {
  if (!usuario) return null;
  const { password, ...resto } = usuario;
  return resto;
}

export function nombreCompleto(usuario) {
  if (!usuario) return '—';
  return `${usuario.nombres.split(' ')[0]} ${usuario.apellidos}`;
}

export function iniciales(usuario) {
  if (!usuario) return '?';
  return `${usuario.nombres[0]}${usuario.apellidos[0]}`.toUpperCase();
}

// ---------- Sesión ----------
/** Usuario logueado según el servidor (lanza ApiError 401 si no hay sesión) */
export async function obtenerSesion() {
  const usuario = await apiGet('/api/v1/sessions');
  sincronizarUsuarioLocal(usuario);
  return usuario;
}

/**
 * Entrega 1: tickets, cola y atención todavía leen los usuarios del seed local (localStorage).
 * Se copia ahí al usuario de la sesión para que las cuentas nuevas (registro o invitación) y los datos
 * editados en "Mi cuenta" también se vean en esas vistas.
 */
function sincronizarUsuarioLocal(usuario) {
  const usuarios = getTable('usuarios');
  const idx = usuarios.findIndex((u) => u.id === usuario.id);
  if (idx >= 0) usuarios[idx] = { ...sinPassword(usuarios[idx]), ...usuario };
  else usuarios.push(usuario);
  saveTable('usuarios', usuarios);
}

// ---------- Registro ----------
export async function listarUnidades() {
  return apiGet('/api/v1/unidades');
}

/** Valida los datos del registro en el navegador (el servidor repite las mismas reglas). Devuelve { campo: mensaje } */
export function validarRegistro(data) {
  const errores = {};
  if (!data.nombres?.trim()) errores.nombres = 'Los nombres son obligatorios.';
  if (!data.apellidos?.trim()) errores.apellidos = 'Los apellidos son obligatorios.';
  if (!data.email?.trim()) errores.email = 'El correo es obligatorio.';
  else if (!EMAIL_INSTITUCIONAL.test(data.email.trim())) errores.email = 'Usa tu correo institucional (@ulima.edu.pe o @aloe.ulima.edu.pe).';
  const tel = validarTelefono(data.telefono); if (tel) errores.telefono = tel;
  const pass = validarPassword(data.password); if (pass) errores.password = pass;
  if (data.password !== data.confirmar) errores.confirmar = 'Las contraseñas no coinciden.';
  if (!data.unidad) errores.unidad = 'Selecciona tu unidad o carrera.';
  if (!data.vinculo) errores.vinculo = 'Selecciona tu vínculo con la universidad.';
  if (!data.terminos) errores.terminos = 'Debes aceptar los términos del servicio.';
  return errores;
}

export async function emailDisponible(email) {
  const { disponible } = await apiGet('/api/v1/registro/disponible', { email });
  return disponible;
}

/** Crea la cuenta y deja la sesión iniciada en el servidor */
export async function registrar(data) {
  return apiPost('/api/v1/registro', data);
}

// ---------- Invitaciones (técnicos y supervisores) ----------
export async function obtenerInvitacion(token) {
  return apiGet(`/api/v1/invitaciones/${token}`);
}

/** Activa la cuenta y deja la sesión iniciada en el servidor */
export async function aceptarInvitacion(token, { password, confirmar, telefono, especialidades }) {
  return apiPost(`/api/v1/invitaciones/${token}/aceptar`, { password, confirmar, telefono, especialidades });
}

export async function rechazarInvitacion(token) {
  return apiPost(`/api/v1/invitaciones/${token}/rechazar`);
}

/** Usada por el supervisor (HU-2 · Técnicos por categoría) para invitar personal */
export async function crearInvitacion(data) {
  return apiPost('/api/v1/invitaciones', data);
}

// ---------- Recuperación de contraseña ----------
/** No se envían correos reales (fuera de alcance): el servidor devuelve el enlace para mostrarlo en pantalla */
export async function solicitarRecuperacion(email) {
  return apiPost('/api/v1/recuperar', { email });
}

export async function validarTokenRecuperacion(token) {
  return apiGet(`/api/v1/recuperar/${token}`);
}

export async function restablecerPassword(token, password, confirmar) {
  return apiPost('/api/v1/restablecer', { token, password, confirmar });
}

// ---------- Mi cuenta (siempre sobre el usuario de la sesión) ----------
export async function actualizarCuenta(data) {
  return apiPut('/api/v1/cuenta', data);
}

export async function cambiarPassword({ actual, nueva, confirmar }) {
  return apiPut('/api/v1/cuenta/password', { actual, nueva, confirmar });
}

// ---------- Lectura para otras historias ----------
export function listarUsuariosSync(filtro = {}) {
  return getTable('usuarios')
    .filter((u) => !filtro.rol || u.rol === filtro.rol)
    .map(sinPassword);
}

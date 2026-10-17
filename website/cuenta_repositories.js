// website/repositores.js
// website/repositories/cuenta_repositories.js
// HU-1 · Única capa que toca los datos de cuenta: usuarios, invitaciones, unidades y tokens de recuperación.
// Entrega 1: sin base de datos. Se carga db/seed/seed.json al iniciar y todo vive en memoria
// (se reinicia al reiniciar el servidor). En la Entrega 2 estas funciones consultan Supabase.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(fs.readFileSync(path.join(__dirname, '../../db/seed/seed.json'), 'utf8'));

// Igual que en el front: las fechas del seed se desplazan al día de hoy para que los plazos tengan sentido
const offset = Date.now() - new Date(seed.fechaReferencia).getTime();
const desplazar = (value) => (value ? new Date(new Date(value).getTime() + offset).toISOString() : value);

const db = {
  usuarios: seed.usuarios.map((u) => ({ ...u, ultimoAcceso: desplazar(u.ultimoAcceso) })),
  invitaciones: seed.invitaciones.map((i) => ({ ...i, creadoEn: desplazar(i.creadoEn), venceEn: desplazar(i.venceEn) })),
  recuperaciones: [...seed.recuperaciones],
  unidades: [...seed.unidades],
  // Solo lectura (landing y validación de especialidades). Dueña: HU-2.
  categorias: seed.categorias,
  prioridades: seed.prioridades,
  // Intentos fallidos de login por correo: { fallidos, bloqueadoHasta }
  intentos: {},
};

const copia = (x) => (x === undefined ? null : structuredClone(x));
const siguienteId = (tabla) => db[tabla].reduce((max, r) => Math.max(max, Number(r.id) || 0), 0) + 1;

// ---------- Usuarios ----------
export function buscarUsuarioPorId(id) {
  return copia(db.usuarios.find((u) => u.id === Number(id)));
}

export function buscarUsuarioPorEmail(email) {
  const correo = (email || '').trim().toLowerCase();
  return copia(db.usuarios.find((u) => u.email.toLowerCase() === correo));
}

export function crearUsuario(datos) {
  const usuario = { ...datos, id: siguienteId('usuarios') };
  db.usuarios.push(usuario);
  return copia(usuario);
}

export function actualizarUsuario(id, cambios) {
  const usuario = db.usuarios.find((u) => u.id === Number(id));
  if (!usuario) return null;
  Object.assign(usuario, cambios);
  return copia(usuario);
}

// ---------- Invitaciones ----------
export function buscarInvitacionPorToken(token) {
  return copia(db.invitaciones.find((i) => i.token === token));
}

export function crearInvitacion(datos) {
  const invitacion = { ...datos, id: siguienteId('invitaciones') };
  db.invitaciones.push(invitacion);
  return copia(invitacion);
}

export function actualizarInvitacion(token, cambios) {
  const invitacion = db.invitaciones.find((i) => i.token === token);
  if (!invitacion) return null;
  Object.assign(invitacion, cambios);
  return copia(invitacion);
}

// ---------- Recuperación de contraseña ----------
export function crearRecuperacion(datos) {
  const recuperacion = { ...datos, id: siguienteId('recuperaciones') };
  db.recuperaciones.push(recuperacion);
  return copia(recuperacion);
}

export function buscarRecuperacionPorToken(token) {
  return copia(db.recuperaciones.find((r) => r.token === token));
}

export function marcarRecuperacionUsada(token) {
  const recuperacion = db.recuperaciones.find((r) => r.token === token);
  if (recuperacion) recuperacion.usado = true;
}

// ---------- Intentos de inicio de sesión ----------
export function leerIntentos(email) {
  return copia(db.intentos[email]) || { fallidos: 0, bloqueadoHasta: null };
}

export function guardarIntentos(email, registro) {
  db.intentos[email] = { ...registro };
}

export function borrarIntentos(email) {
  delete db.intentos[email];
}

// ---------- Catálogos de solo lectura ----------
export function listarUnidades() {
  return copia(db.unidades);
}

export function listarCategorias() {
  return copia(db.categorias);
}

export function listarPrioridades() {
  return copia(db.prioridades);
}

// src/services/api.client.js
// Punto único de acceso a datos del front.
// Entrega 1: la cuenta y la sesión (auth.service) van al servidor; tickets, catálogo, cola y atención trabajan
// contra db/seed/seed.json (copiado en memoria y guardado en localStorage).
// Entrega 2: con VITE_USE_MOCK=false todos los services usan apiGet/apiPost/apiPut/apiDelete contra Express.
import axios from 'axios';
import seed from '@seed/seed.json';

export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';

const STORAGE_KEY = 'mesa_ayuda_db_v1';

// Campos de fecha que se desplazan para que los datos semilla siempre se vean "recientes"
const DATE_FIELDS = ['creadoEn', 'venceEn', 'resueltoEn', 'cerradoEn', 'fechaRetorno', 'ultimoAcceso'];

function shiftSeedDates(data) {
  const offset = Date.now() - new Date(data.fechaReferencia).getTime();
  const shift = (value) => (value ? new Date(new Date(value).getTime() + offset).toISOString() : value);
  ['tickets', 'bitacora', 'historialEstados', 'asignaciones', 'cambiosPrioridad', 'invitaciones'].forEach((table) => {
    data[table].forEach((row) => DATE_FIELDS.forEach((f) => { if (row[f]) row[f] = shift(row[f]); }));
  });
  data.usuarios.forEach((u) => { u.ultimoAcceso = shift(u.ultimoAcceso); });
  return data;
}

let db = null;

function load() {
  if (db) return db;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) db = JSON.parse(saved);
  } catch { db = null; }
  if (!db) db = shiftSeedDates(structuredClone(seed));
  return db;
}

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); } catch { /* sin almacenamiento: queda en memoria */ }
}

/** Devuelve una copia de la tabla para que las páginas no muten el estado directamente */
export function getTable(name) {
  return structuredClone(load()[name]);
}

/** Reemplaza la tabla completa y la guarda */
export function saveTable(name, rows) {
  load()[name] = rows;
  persist();
  // Avisa a la cabecera y al menú para que actualicen sus contadores
  window.dispatchEvent(new CustomEvent(DATA_EVENT, { detail: name }));
}

export const DATA_EVENT = 'mesa-ayuda:datos';

export function nextId(name) {
  const rows = load()[name];
  return rows.reduce((max, r) => Math.max(max, Number(r.id) || 0), 0) + 1;
}

/** Simula la latencia de red para que la UI muestre sus estados de carga */
export function delay(value, ms = 250) {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

/** Error de negocio con código HTTP equivalente (400, 401, 403, 404, 409) */
export class ApiError extends Error {
  constructor(message, status = 400, field = null) {
    super(message);
    this.status = status;
    this.field = field;
  }
}

/** Restaura los datos de prueba originales */
export function resetMockData() {
  db = shiftSeedDates(structuredClone(seed));
  persist();
}

// ---------- Llamadas al servidor (cuenta y sesión desde la Entrega 1; todo lo demás en la Entrega 2) ----------
const http = axios.create({ withCredentials: true });

/** Convierte la respuesta de error { success, message, data, error } en ApiError (error trae los mensajes por campo) */
async function pedir(peticion) {
  try {
    const { data } = await peticion;
    return data.data;
  } catch (ex) {
    const body = ex.response?.data || {};
    const err = new ApiError(body.message || 'No se pudo conectar con el servidor.', ex.response?.status || 500);
    if (body.error && typeof body.error === 'object') err.errores = body.error;
    throw err;
  }
}

export function apiGet(url, params) {
  return pedir(http.get(url, { params }));
}

export function apiPost(url, body) {
  return pedir(http.post(url, body));
}

export function apiPut(url, body) {
  return pedir(http.put(url, body));
}

export function apiDelete(url) {
  return pedir(http.delete(url));
}

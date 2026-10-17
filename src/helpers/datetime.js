// src/helpers/datetime.js
export const toDatetimeLocalWithSeconds = (dateStr) => {
  const date = new Date(dateStr);
  const offset = date.getTimezoneOffset();
  date.setMinutes(date.getMinutes() - offset); // Convertir a hora local
  return date.toISOString().slice(0, 19); // YYYY-MM-DDTHH:MM:SS
};

const pad = (n) => String(n).padStart(2, '0');

/** 07/09/2026 */
export function formatFecha(value) {
  if (!value) return '—';
  const d = new Date(value);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** 08:12 */
export function formatHora(value) {
  if (!value) return '—';
  const d = new Date(value);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 07/09/2026 08:12 */
export function formatFechaHora(value) {
  if (!value) return '—';
  return `${formatFecha(value)} ${formatHora(value)}`;
}

/** yyyy-mm-dd para inputs type="date" */
export function toInputDate(value) {
  const d = value ? new Date(value) : new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 1 d 6 h 12 min */
export function formatDuracion(ms) {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  const parts = [];
  if (d) parts.push(`${d} d`);
  if (h) parts.push(`${h} h`);
  if (m || parts.length === 0) parts.push(`${m} min`);
  return parts.join(' ');
}

/** Tiempo transcurrido desde una fecha: "18 min", "1 h 10 min" */
export function haceCuanto(value) {
  return formatDuracion(Date.now() - new Date(value).getTime());
}

/** "Vence en 1 h 42 min" | "Vencido hace 20 min" */
export function plazoTexto(venceEn) {
  const diff = new Date(venceEn).getTime() - Date.now();
  return diff >= 0 ? `Vence en ${formatDuracion(diff)}` : `Vencido hace ${formatDuracion(-diff)}`;
}

export default toDatetimeLocalWithSeconds;

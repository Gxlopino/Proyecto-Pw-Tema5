// src/services/atencion.service.js
// HU-5 · Atención y cierre. Dueña de bitácora_entrada e historial_estado.
// registrarCambioEstado y registrarEntrada son los únicos puntos de escritura de esas tablas;
// HU-3 y HU-4 los usan para dejar constancia de sus propios eventos.
import { USE_MOCK, getTable, saveTable, nextId, delay, ApiError, apiGet, apiPost } from './api.client';
import { nombreCompleto, iniciales } from './auth.service';
import { enriquecerTicket } from './tickets.service';
import { formatDuracion } from '../helpers/datetime';

export const TRANSICIONES = {
  abierto: ['en_atencion'],
  reabierto: ['en_atencion'],
  en_atencion: ['en_espera', 'resuelto'],
  en_espera: ['en_atencion'],
  resuelto: ['en_atencion'],
};

export const DESCRIPCION_ESTADO = {
  en_atencion: 'el técnico está trabajando en la falla',
  en_espera: 'falta un repuesto o depende de un tercero',
  resuelto: 'la falla ya no se presenta',
  abierto: 'pendiente de atención',
};

const ESTADOS_UI = ['en_atencion', 'en_espera', 'resuelto', 'abierto'];
const MIN_SOLUCION = 15;

// ---------- Escritura interna ----------
export function registrarCambioEstado(ticketId, estadoAnterior, estadoNuevo, autorId, motivo = null) {
  const historial = getTable('historialEstados');
  const fila = { id: nextId('historialEstados'), ticketId, estadoAnterior, estadoNuevo, autorId, motivo, creadoEn: new Date().toISOString() };
  historial.push(fila);
  saveTable('historialEstados', historial);
  return fila;
}

export function registrarEntrada(ticketId, autorId, tipo, texto) {
  const bitacora = getTable('bitacora');
  const fila = { id: nextId('bitacora'), ticketId, autorId, tipo, texto, creadoEn: new Date().toISOString() };
  bitacora.push(fila);
  saveTable('bitacora', bitacora);
  return fila;
}

// ---------- Permisos ----------
export function puedeAtender(ticket, usuario) {
  if (!usuario) return false;
  if (usuario.rol === 'supervisor') return true;
  return usuario.rol === 'tecnico' && ticket.tecnicoId === usuario.id;
}

function obtenerParaAtender(codigo, usuario) {
  const tickets = getTable('tickets');
  const t = tickets.find((x) => x.codigo === codigo);
  if (!t) throw new ApiError('No encontramos ese ticket.', 404);
  if (!puedeAtender(t, usuario)) throw new ApiError('Este ticket no está asignado a ti.', 403);
  return { tickets, t };
}

// ---------- Bitácora ----------
export async function listarBitacora(ticketId, { incluirInternas = false } = {}) {
  if (!USE_MOCK) return apiGet(`/api/admin/tickets/${ticketId}/bitacora`, { incluirInternas });
  const usuarios = getTable('usuarios');
  const lista = getTable('bitacora')
    .filter((b) => b.ticketId === ticketId && (incluirInternas || b.tipo === 'publico'))
    .sort((a, b) => new Date(a.creadoEn) - new Date(b.creadoEn))
    .map((b) => {
      const autor = usuarios.find((u) => u.id === b.autorId);
      return { ...b, autor: nombreCompleto(autor), autorRol: autor?.rol, autorIniciales: iniciales(autor) };
    });
  return delay(lista, 100);
}

export async function agregarEntrada(codigo, usuario, tipo, texto) {
  if (!USE_MOCK) return apiPost(`/api/admin/tickets/${codigo}/bitacora`, { tipo, texto });
  const { t } = obtenerParaAtender(codigo, usuario);
  if (['cerrado', 'cancelado'].includes(t.estado)) throw new ApiError('El ticket ya está cerrado.', 409);
  if (!['publico', 'interno'].includes(tipo)) throw new ApiError('Tipo de entrada no válido.', 400);
  if (!texto?.trim()) throw Object.assign(new ApiError('Escribe el detalle.', 400), { errores: { texto: 'Escribe el detalle del avance.' } });
  if (texto.length > 600) throw Object.assign(new ApiError('Texto muy largo.', 400), { errores: { texto: 'Máximo 600 caracteres.' } });
  return delay(registrarEntrada(t.id, usuario.id, tipo, texto.trim()), 300);
}

// ---------- Estados ----------
/** Opciones del modal 5.3: permitidas y no permitidas desde el estado actual */
export function opcionesDeEstado(estadoActual) {
  const permitidas = TRANSICIONES[estadoActual] || [];
  return ESTADOS_UI.filter((e) => e !== estadoActual).map((e) => ({ estado: e, permitida: permitidas.includes(e) }));
}

export async function cambiarEstado(codigo, usuario, nuevo, { motivoEspera = '', fechaRetorno = '' } = {}) {
  if (!USE_MOCK) return apiPost(`/api/admin/tickets/${codigo}/estado`, { estado: nuevo, motivoEspera, fechaRetorno });
  const { tickets, t } = obtenerParaAtender(codigo, usuario);
  const permitidas = TRANSICIONES[t.estado] || [];
  if (!permitidas.includes(nuevo)) throw new ApiError('Esa transición no está permitida desde el estado actual.', 409);
  if (nuevo === 'en_atencion' && !t.tecnicoId) throw new ApiError('Asigna un técnico antes de iniciar la atención.', 409);

  if (nuevo === 'en_espera') {
    const errores = {};
    if (!motivoEspera.trim()) errores.motivoEspera = 'Indica el motivo de la espera.';
    if (!fechaRetorno) errores.fechaRetorno = 'Indica la fecha estimada de retorno.';
    else if (new Date(`${fechaRetorno}T23:59:59`) < new Date()) errores.fechaRetorno = 'La fecha no puede ser pasada.';
    if (Object.keys(errores).length) throw Object.assign(new ApiError('Revisa los campos marcados.', 400), { errores });
    t.motivoEspera = motivoEspera.trim();
    t.fechaRetorno = new Date(`${fechaRetorno}T12:00:00`).toISOString();
  }

  // El tiempo en espera no cuenta para el tiempo esperado: al retomar se corre el vencimiento.
  if (t.estado === 'en_espera' && nuevo === 'en_atencion') {
    const inicioEspera = [...getTable('historialEstados')].reverse().find((h) => h.ticketId === t.id && h.estadoNuevo === 'en_espera');
    if (inicioEspera) {
      const pausa = Date.now() - new Date(inicioEspera.creadoEn).getTime();
      t.venceEn = new Date(new Date(t.venceEn).getTime() + pausa).toISOString();
    }
    t.motivoEspera = null;
    t.fechaRetorno = null;
  }
  if (nuevo === 'resuelto') t.resueltoEn = new Date().toISOString();

  const anterior = t.estado;
  t.estado = nuevo;
  saveTable('tickets', tickets);
  registrarCambioEstado(t.id, anterior, nuevo, usuario.id, nuevo === 'en_espera' ? t.motivoEspera : null);
  return delay(enriquecerTicket(t), 300);
}

export function puedeCerrar(t) {
  return ['en_atencion', 'resuelto'].includes(t.estado);
}

/** Tiempo de atención: total menos el tiempo en espera */
export function calcularTiempos(ticket, historial = getTable('historialEstados')) {
  const filas = historial.filter((h) => h.ticketId === ticket.id).sort((a, b) => new Date(a.creadoEn) - new Date(b.creadoEn));
  const fin = ticket.cerradoEn ? new Date(ticket.cerradoEn).getTime() : Date.now();
  let espera = 0;
  filas.forEach((h, i) => {
    if (h.estadoNuevo === 'en_espera') {
      const hasta = filas[i + 1] ? new Date(filas[i + 1].creadoEn).getTime() : fin;
      espera += hasta - new Date(h.creadoEn).getTime();
    }
  });
  const total = fin - new Date(ticket.creadoEn).getTime();
  return { total, espera, atencion: total - espera };
}

export async function cerrarTicket(codigo, usuario, solucion) {
  if (!USE_MOCK) return apiPost(`/api/admin/tickets/${codigo}/cerrar`, { solucion });
  const { tickets, t } = obtenerParaAtender(codigo, usuario);
  if (!puedeCerrar(t)) throw new ApiError('Solo se puede cerrar un ticket en atención o resuelto.', 409);
  if (!solucion?.trim() || solucion.trim().length < MIN_SOLUCION) {
    throw Object.assign(new ApiError('Describe la solución.', 400), { errores: { solucion: `Describe la solución aplicada (mínimo ${MIN_SOLUCION} caracteres).` } });
  }
  const anterior = t.estado;
  const ahora = new Date().toISOString();
  if (anterior === 'en_atencion') {
    t.resueltoEn = ahora;
    registrarCambioEstado(t.id, 'en_atencion', 'resuelto', usuario.id);
  }
  t.estado = 'cerrado';
  t.cerradoEn = ahora;
  t.solucion = solucion.trim();
  saveTable('tickets', tickets);
  registrarCambioEstado(t.id, 'resuelto', 'cerrado', usuario.id, 'Solución aplicada');
  registrarEntrada(t.id, usuario.id, 'publico', `Ticket cerrado. Solución: ${t.solucion}`);
  return delay(enriquecerTicket(t), 400);
}

// ---------- Historial ----------
/** Línea de tiempo completa: estados, asignaciones y cambios de prioridad */
export async function obtenerHistorial(codigo, usuario) {
  if (!USE_MOCK) return apiGet(`/api/admin/tickets/${codigo}/historial`);
  const ticket = getTable('tickets').find((x) => x.codigo === codigo);
  if (!ticket) throw new ApiError('No encontramos ese ticket.', 404);
  if (usuario?.rol === 'tecnico' && ticket.tecnicoId !== usuario.id) throw new ApiError('Este ticket no está asignado a ti.', 403);

  const usuarios = getTable('usuarios');
  const estados = getTable('estadosTicket');
  const persona = (id) => {
    const u = usuarios.find((x) => x.id === id);
    return u ? `${nombreCompleto(u)} (${u.rol})` : 'Sistema';
  };
  const nombreEstado = (c) => estados.find((e) => e.codigo === c)?.nombre || c;
  const historial = getTable('historialEstados').filter((h) => h.ticketId === ticket.id).sort((a, b) => new Date(a.creadoEn) - new Date(b.creadoEn));
  const fin = ticket.cerradoEn ? new Date(ticket.cerradoEn).getTime() : Date.now();

  const eventos = [
    ...historial.map((h, i) => {
      const siguiente = historial[i + 1];
      const dur = (siguiente ? new Date(siguiente.creadoEn).getTime() : fin) - new Date(h.creadoEn).getTime();
      return {
        tipo: 'estado',
        estado: h.estadoNuevo,
        titulo: h.estadoAnterior ? `${nombreEstado(h.estadoAnterior)} → ${nombreEstado(h.estadoNuevo)}` : nombreEstado(h.estadoNuevo),
        detalle: [persona(h.autorId), h.motivo].filter(Boolean).join(' · '),
        permanencia: h.estadoNuevo === 'cerrado' || h.estadoNuevo === 'cancelado' ? null : `Permaneció ${formatDuracion(dur)} en este estado`,
        duracion: dur,
        creadoEn: h.creadoEn,
      };
    }),
    ...getTable('asignaciones').filter((a) => a.ticketId === ticket.id).map((a) => ({
      tipo: 'asignacion',
      titulo: a.tipo === 'devolucion' ? 'Devuelto a la cola' : `${a.tipo === 'reasignacion' ? 'Reasignado' : a.tipo === 'autoasignacion' ? 'Autoasignado' : 'Asignado'} a ${nombreCompleto(usuarios.find((u) => u.id === a.tecnicoId))}`,
      detalle: [persona(a.asignadoPorId), a.motivo, a.nota].filter(Boolean).join(' · '),
      creadoEn: a.creadoEn,
    })),
    ...getTable('cambiosPrioridad').filter((c) => c.ticketId === ticket.id).map((c) => ({
      tipo: 'prioridad',
      titulo: `Prioridad ${c.anterior} → ${c.nueva}`,
      detalle: [persona(c.autorId), c.motivo].filter(Boolean).join(' · '),
      creadoEn: c.creadoEn,
    })),
  ].sort((a, b) => new Date(a.creadoEn) - new Date(b.creadoEn));

  // Tiempo acumulado por etapa
  const porEtapa = {};
  eventos.filter((e) => e.tipo === 'estado' && e.permanencia).forEach((e) => {
    porEtapa[e.estado] = (porEtapa[e.estado] || 0) + e.duracion;
  });
  const tiempos = calcularTiempos(ticket, historial);
  return delay({
    ticket: enriquecerTicket(ticket),
    eventos,
    etapas: Object.entries(porEtapa).map(([estado, ms]) => ({ estado, nombre: nombreEstado(estado), ms })),
    tiempos,
  }, 150);
}

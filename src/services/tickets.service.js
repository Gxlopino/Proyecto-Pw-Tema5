// src/services/tickets.service.js
// HU-3 · Registro y seguimiento de tickets. Dueña de la entidad ticket (registro, cancelación y reapertura).
import { USE_MOCK, getTable, saveTable, nextId, delay, ApiError, apiGet, apiPost } from './api.client';
import { nombreCompleto, sinPassword } from './auth.service';
import { ESTADOS_ABIERTOS, horasPorPrioridad, nombreTipoAmbiente } from './catalogo.service';
import { registrarCambioEstado, registrarEntrada } from './atencion.service';

export const PLAZO_REAPERTURA_DIAS = 7;
export const MAX_DESCRIPCION = 600;

export function estadosSync() {
  return getTable('estadosTicket');
}

/** Agrega los nombres que las vistas necesitan (categoría, ambiente, personas) */
export function enriquecerTicket(t, ctx = null) {
  const c = ctx || {
    categorias: getTable('categorias'),
    ambientes: getTable('ambientes'),
    sedes: getTable('sedes'),
    usuarios: getTable('usuarios'),
  };
  const categoria = c.categorias.find((x) => x.id === t.categoriaId);
  const subcategoria = c.categorias.find((x) => x.id === t.subcategoriaId);
  const ambiente = c.ambientes.find((x) => x.id === t.ambienteId);
  const solicitante = c.usuarios.find((x) => x.id === t.solicitanteId);
  const tecnico = c.usuarios.find((x) => x.id === t.tecnicoId);
  const sede = ambiente && c.sedes.find((s) => s.id === ambiente.sedeId);
  return {
    ...t,
    categoria: categoria?.nombre || '—',
    subcategoria: subcategoria?.nombre || '—',
    ambiente: ambiente?.codigo || '—',
    ambienteDetalle: ambiente
      ? `${nombreTipoAmbiente(ambiente.tipo)} · Pabellón ${ambiente.pabellon} · piso ${ambiente.piso} · capacidad ${ambiente.capacidad} · ${sede?.nombre || ''}`
      : '',
    solicitante: nombreCompleto(solicitante),
    solicitanteTelefono: solicitante?.telefono || '—',
    tecnico: tecnico ? nombreCompleto(tecnico) : null,
    vencido: ESTADOS_ABIERTOS.includes(t.estado) && t.estado !== 'en_espera' && new Date(t.venceEn) < new Date(),
  };
}

export function contextoTickets() {
  return {
    categorias: getTable('categorias'),
    ambientes: getTable('ambientes'),
    sedes: getTable('sedes'),
    usuarios: getTable('usuarios').map(sinPassword),
  };
}

function siguienteCodigo(tickets) {
  const anio = new Date().getFullYear();
  const max = tickets.reduce((m, t) => Math.max(m, Number(t.codigo.split('-')[2]) || 0), 0);
  return `TCK-${anio}-${String(max + 1).padStart(5, '0')}`;
}

// ---------- Registro ----------
/** Ticket abierto para el mismo ambiente y la misma categoría */
export async function buscarDuplicado(ambienteId, categoriaId) {
  if (!ambienteId || !categoriaId) return null;
  if (!USE_MOCK) return apiGet('/api/website/tickets/duplicado', { ambienteId, categoriaId });
  const t = getTable('tickets').find((x) => x.ambienteId === Number(ambienteId) && x.categoriaId === Number(categoriaId) && ESTADOS_ABIERTOS.includes(x.estado));
  return delay(t ? enriquecerTicket(t) : null, 100);
}

export function validarTicket(data) {
  const errores = {};
  const categorias = getTable('categorias');
  const categoria = categorias.find((c) => c.id === Number(data.categoriaId));
  const sub = categorias.find((c) => c.id === Number(data.subcategoriaId));
  if (!categoria) errores.categoriaId = 'Selecciona la categoría.';
  else if (!categoria.activa) errores.categoriaId = 'La categoría está inactiva y no admite tickets nuevos.';
  if (!sub) errores.subcategoriaId = 'Selecciona la subcategoría.';
  else if (sub.parentId !== Number(data.categoriaId)) errores.subcategoriaId = 'La subcategoría no pertenece a la categoría elegida.';
  else if (!sub.activa) errores.subcategoriaId = 'La subcategoría está inactiva.';
  if (!getTable('ambientes').some((a) => a.id === Number(data.ambienteId))) errores.ambienteId = 'Selecciona el ambiente afectado.';
  const asunto = (data.asunto || '').trim();
  if (asunto.length < 5) errores.asunto = 'Escribe un asunto de al menos 5 caracteres.';
  else if (asunto.length > 100) errores.asunto = 'Máximo 100 caracteres.';
  const desc = (data.descripcion || '').trim();
  if (desc.length < 20) errores.descripcion = 'Describe la falla con al menos 20 caracteres.';
  else if (desc.length > MAX_DESCRIPCION) errores.descripcion = `Máximo ${MAX_DESCRIPCION} caracteres.`;
  if (!data.prioridadSugerida) errores.prioridadSugerida = 'Selecciona la prioridad sugerida.';
  return errores;
}

export async function crearTicket(data, usuarioId) {
  if (!USE_MOCK) return apiPost('/api/website/tickets', data);
  const errores = validarTicket(data);
  if (Object.keys(errores).length) throw Object.assign(new ApiError('Revisa los campos marcados.', 400), { errores });

  const tickets = getTable('tickets');
  const sub = getTable('categorias').find((c) => c.id === Number(data.subcategoriaId));
  const ahora = new Date();
  const horas = data.prioridadSugerida === sub.prioridadDefecto ? sub.tiempoEsperadoHoras : horasPorPrioridad(data.prioridadSugerida);
  const ticket = {
    id: nextId('tickets'),
    codigo: siguienteCodigo(tickets),
    asunto: data.asunto.trim(),
    descripcion: data.descripcion.trim(),
    categoriaId: Number(data.categoriaId),
    subcategoriaId: Number(data.subcategoriaId),
    ambienteId: Number(data.ambienteId),
    solicitanteId: usuarioId,
    tecnicoId: null,
    prioridad: data.prioridadSugerida,
    prioridadSugerida: data.prioridadSugerida,
    estado: 'abierto',
    creadoEn: ahora.toISOString(),
    venceEn: new Date(ahora.getTime() + horas * 3600000).toISOString(),
    resueltoEn: null,
    cerradoEn: null,
    solucion: null,
    motivoEspera: null,
    fechaRetorno: null,
    motivoCancelacion: null,
    motivoReapertura: null,
  };
  tickets.push(ticket);
  saveTable('tickets', tickets);
  registrarCambioEstado(ticket.id, null, 'abierto', usuarioId, 'Ticket registrado');
  return delay(enriquecerTicket(ticket), 500);
}

// ---------- Seguimiento ----------
export async function listarMisTickets(usuarioId, { estado = '', desde = '', hasta = '', codigo = '', categoriaId = '' } = {}) {
  if (!USE_MOCK) return apiGet('/api/website/tickets', { estado, desde, hasta, codigo, categoriaId });
  const ctx = contextoTickets();
  const texto = codigo.trim().toUpperCase();
  const lista = getTable('tickets')
    .filter((t) => t.solicitanteId === usuarioId)
    .filter((t) => !estado || (estado === 'en_curso' ? ESTADOS_ABIERTOS.includes(t.estado) : t.estado === estado))
    .filter((t) => !desde || new Date(t.creadoEn) >= new Date(`${desde}T00:00:00`))
    .filter((t) => !hasta || new Date(t.creadoEn) <= new Date(`${hasta}T23:59:59`))
    .filter((t) => !texto || t.codigo.includes(texto))
    .filter((t) => !categoriaId || t.categoriaId === Number(categoriaId))
    .sort((a, b) => new Date(b.creadoEn) - new Date(a.creadoEn))
    .map((t) => enriquecerTicket(t, ctx));
  return delay(lista);
}

export function resumenUsuarioSync(usuarioId) {
  const mios = getTable('tickets').filter((t) => t.solicitanteId === usuarioId);
  return { total: mios.length, abiertos: mios.filter((t) => ESTADOS_ABIERTOS.includes(t.estado)).length };
}

/** Obtiene un ticket por código validando quién lo puede ver */
export async function obtenerTicket(codigo, usuario) {
  if (!USE_MOCK) return apiGet(`/api/website/tickets/${codigo}`);
  const t = getTable('tickets').find((x) => x.codigo === codigo);
  if (!t) throw new ApiError('No encontramos ese ticket.', 404);
  if (usuario?.rol === 'usuario' && t.solicitanteId !== usuario.id) throw new ApiError('Este ticket no es tuyo.', 403);
  return delay(enriquecerTicket(t), 150);
}

export function puedeReabrir(t) {
  if (t.estado !== 'cerrado' || !t.cerradoEn) return false;
  return Date.now() - new Date(t.cerradoEn).getTime() <= PLAZO_REAPERTURA_DIAS * 86400000;
}

export function puedeCancelar(t) {
  return t.estado === 'abierto' && !t.tecnicoId;
}

export async function agregarInformacion(codigo, usuario, texto) {
  if (!USE_MOCK) return apiPost(`/api/website/tickets/${codigo}/informacion`, { texto });
  const t = getTable('tickets').find((x) => x.codigo === codigo);
  if (!t || t.solicitanteId !== usuario.id) throw new ApiError('No encontramos ese ticket.', 404);
  if (['cerrado', 'cancelado'].includes(t.estado)) throw new ApiError('El ticket ya no admite comentarios.', 409);
  if (!texto?.trim()) throw Object.assign(new ApiError('Escribe un comentario.', 400), { errores: { texto: 'Escribe un comentario.' } });
  if (texto.length > MAX_DESCRIPCION) throw Object.assign(new ApiError('Comentario muy largo.', 400), { errores: { texto: `Máximo ${MAX_DESCRIPCION} caracteres.` } });
  return delay(registrarEntrada(t.id, usuario.id, 'publico', texto.trim()), 300);
}

export async function cancelarTicket(codigo, usuario, motivo = '') {
  if (!USE_MOCK) return apiPost(`/api/website/tickets/${codigo}/cancelar`, { motivo });
  const tickets = getTable('tickets');
  const t = tickets.find((x) => x.codigo === codigo);
  if (!t || t.solicitanteId !== usuario.id) throw new ApiError('No encontramos ese ticket.', 404);
  if (!puedeCancelar(t)) throw new ApiError('Solo puedes cancelar tickets que aún no fueron asignados.', 409);
  t.estado = 'cancelado';
  t.motivoCancelacion = motivo.trim() || 'Cancelado por el usuario';
  saveTable('tickets', tickets);
  registrarCambioEstado(t.id, 'abierto', 'cancelado', usuario.id, t.motivoCancelacion);
  return delay(enriquecerTicket(t), 300);
}

export async function reabrirTicket(codigo, usuario, motivo) {
  if (!USE_MOCK) return apiPost(`/api/website/tickets/${codigo}/reabrir`, { motivo });
  if (!motivo?.trim() || motivo.trim().length < 10) {
    throw Object.assign(new ApiError('Indica el motivo.', 400), { errores: { motivo: 'Explica el motivo con al menos 10 caracteres.' } });
  }
  const tickets = getTable('tickets');
  const t = tickets.find((x) => x.codigo === codigo);
  if (!t || t.solicitanteId !== usuario.id) throw new ApiError('No encontramos ese ticket.', 404);
  if (!puedeReabrir(t)) throw new ApiError(`Solo puedes reabrir un ticket cerrado dentro de los ${PLAZO_REAPERTURA_DIAS} días siguientes al cierre.`, 409);
  t.estado = 'reabierto';
  t.motivoReapertura = motivo.trim();
  t.venceEn = new Date(Date.now() + horasPorPrioridad(t.prioridad) * 3600000).toISOString();
  saveTable('tickets', tickets);
  registrarCambioEstado(t.id, 'cerrado', 'reabierto', usuario.id, t.motivoReapertura);
  registrarEntrada(t.id, usuario.id, 'publico', `Reapertura: ${t.motivoReapertura}`);
  return delay(enriquecerTicket(t), 300);
}

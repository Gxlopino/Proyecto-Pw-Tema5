// src/services/cola.service.js
// HU-4 · Cola y asignación. Dueña de asignación y cambio_prioridad.
import { USE_MOCK, getTable, saveTable, nextId, delay, ApiError, apiGet, apiPost } from './api.client';
import { nombreCompleto } from './auth.service';
import { ESTADOS_ABIERTOS, horasPorPrioridad, tecnicosHabilitadosSync, categoriasDeTecnicoSync } from './catalogo.service';
import { enriquecerTicket, contextoTickets } from './tickets.service';
import { registrarCambioEstado, registrarEntrada } from './atencion.service';

export const ESTADOS_COLA = ['abierto', 'reabierto', 'en_atencion', 'en_espera', 'resuelto'];

function ordenPrioridad() {
  const map = {};
  getTable('prioridades').forEach((p) => { map[p.codigo] = p.orden; });
  return map;
}

function esHoy(fecha) {
  if (!fecha) return false;
  const d = new Date(fecha);
  const hoy = new Date();
  return d.toDateString() === hoy.toDateString();
}

function ordenar(lista, orden) {
  const pr = ordenPrioridad();
  const porAntiguedad = (a, b) => new Date(a.creadoEn) - new Date(b.creadoEn);
  // "Antigüedad" ordena por el tiempo transcurrido desde el registro, de menor a mayor (como en el mockup 4.1)
  if (orden === 'antiguedad') return lista.sort((a, b) => new Date(b.creadoEn) - new Date(a.creadoEn));
  if (orden === 'prioridad') return lista.sort((a, b) => pr[a.prioridad] - pr[b.prioridad] || porAntiguedad(a, b));
  if (orden === 'sin_atencion') {
    // Primero los que nadie atiende todavía (sin técnico), del más antiguo al más reciente
    return lista.sort((a, b) => Number(!!a.tecnicoId) - Number(!!b.tecnicoId) || porAntiguedad(a, b));
  }
  if (orden === 'plazo') return lista.sort((a, b) => pr[a.prioridad] - pr[b.prioridad] || new Date(a.venceEn) - new Date(b.venceEn));
  return lista.sort(porAntiguedad); // mas_antiguos
}

// ---------- Cola general (supervisor) ----------
export async function listarCola({ busqueda = '', prioridades = [], estados = [], categoriaId = '', ambienteId = '', orden = 'antiguedad' } = {}) {
  if (!USE_MOCK) return apiGet('/api/admin/cola', { busqueda, prioridades: prioridades.join(','), estados: estados.join(','), categoriaId, ambienteId, orden });
  const ctx = contextoTickets();
  const texto = busqueda.trim().toLowerCase();
  const lista = getTable('tickets')
    .filter((t) => (estados.length ? estados.includes(t.estado) : ESTADOS_COLA.includes(t.estado)))
    .filter((t) => !prioridades.length || prioridades.includes(t.prioridad))
    .filter((t) => !categoriaId || t.categoriaId === Number(categoriaId))
    .filter((t) => !ambienteId || t.ambienteId === Number(ambienteId))
    .map((t) => enriquecerTicket(t, ctx))
    .filter((t) => !texto || t.codigo.toLowerCase().includes(texto) || t.asunto.toLowerCase().includes(texto) || t.solicitante.toLowerCase().includes(texto));
  return delay(ordenar(lista, orden));
}

export function resumenColaSync() {
  const tickets = getTable('tickets').map((t) => enriquecerTicket(t));
  const enCola = tickets.filter((t) => ESTADOS_COLA.includes(t.estado));
  return {
    total: enCola.length,
    abiertos: tickets.filter((t) => ['abierto', 'reabierto'].includes(t.estado)).length,
    enAtencion: tickets.filter((t) => t.estado === 'en_atencion').length,
    enEspera: tickets.filter((t) => t.estado === 'en_espera').length,
    resueltosHoy: tickets.filter((t) => ['resuelto', 'cerrado'].includes(t.estado) && esHoy(t.resueltoEn)).length,
    sinAsignar: enCola.filter((t) => !t.tecnicoId).length,
    fueraDeTiempo: enCola.filter((t) => t.vencido).length,
  };
}

/** Técnicos habilitados para la categoría del ticket, con su carga actual */
export function tecnicosParaCategoria(categoriaId) {
  const tickets = getTable('tickets');
  return tecnicosHabilitadosSync(categoriaId).map((tec) => {
    const activos = tickets.filter((t) => t.tecnicoId === tec.id && ESTADOS_ABIERTOS.includes(t.estado));
    return { id: tec.id, nombre: nombreCompleto(tec), carga: activos.length, criticos: activos.filter((t) => t.prioridad === 'critica').length };
  }).sort((a, b) => a.carga - b.carga);
}

/** Todos los técnicos activos con su carga (para la asignación en lote) */
export function cargaTecnicosSync() {
  const tickets = getTable('tickets');
  return getTable('usuarios').filter((u) => u.rol === 'tecnico' && u.estado === 'activo').map((tec) => {
    const activos = tickets.filter((t) => t.tecnicoId === tec.id && ESTADOS_ABIERTOS.includes(t.estado));
    return { id: tec.id, nombre: nombreCompleto(tec), carga: activos.length, criticos: activos.filter((t) => t.prioridad === 'critica').length };
  }).sort((a, b) => a.carga - b.carga);
}

function guardarAsignacion(t, tecnicoId, usuario, tipo, motivo, nota) {
  const asignaciones = getTable('asignaciones');
  asignaciones.push({ id: nextId('asignaciones'), ticketId: t.id, tecnicoId, asignadoPorId: usuario.id, tipo, motivo: motivo || null, nota: nota || null, creadoEn: new Date().toISOString() });
  saveTable('asignaciones', asignaciones);
}

/** Asigna o reasigna un ticket. La reasignación exige motivo. */
export async function asignar(codigo, tecnicoId, usuario, { nota = '', motivo = '' } = {}) {
  if (!USE_MOCK) return apiPost(`/api/admin/cola/${codigo}/asignar`, { tecnicoId, nota, motivo });
  if (usuario.rol !== 'supervisor') throw new ApiError('Solo el supervisor asigna tickets.', 403);
  const tickets = getTable('tickets');
  const t = tickets.find((x) => x.codigo === codigo);
  if (!t) throw new ApiError('No encontramos ese ticket.', 404);
  if (!ESTADOS_COLA.includes(t.estado) || t.estado === 'resuelto') throw new ApiError('Este ticket ya no se puede asignar.', 409);
  if (!tecnicoId) throw Object.assign(new ApiError('Selecciona un técnico.', 400), { errores: { tecnicoId: 'Selecciona un técnico habilitado.' } });
  const habilitado = tecnicosHabilitadosSync(t.categoriaId).some((x) => x.id === Number(tecnicoId));
  if (!habilitado) throw new ApiError('El técnico no está habilitado para esta categoría.', 409);
  if (t.tecnicoId === Number(tecnicoId)) throw new ApiError('El ticket ya está asignado a ese técnico.', 409);
  const esReasignacion = !!t.tecnicoId;
  if (esReasignacion && !motivo.trim()) throw Object.assign(new ApiError('Indica el motivo.', 400), { errores: { motivo: 'La reasignación requiere un motivo.' } });

  t.tecnicoId = Number(tecnicoId);
  saveTable('tickets', tickets);
  guardarAsignacion(t, t.tecnicoId, usuario, esReasignacion ? 'reasignacion' : 'asignacion', motivo.trim(), nota.trim());
  const tecnico = getTable('usuarios').find((u) => u.id === t.tecnicoId);
  registrarEntrada(t.id, usuario.id, 'publico', `${esReasignacion ? 'Reasignado' : 'Asignado'} a ${nombreCompleto(tecnico)}.${nota.trim() ? ` ${nota.trim()}` : ''}`);
  return delay(enriquecerTicket(t), 300);
}

/** Asignación en lote: solo a tickets de categorías que el técnico atiende */
export async function asignarLote(codigos, tecnicoId, usuario, nota = '') {
  if (!USE_MOCK) return apiPost('/api/admin/cola/lote/asignar', { codigos, tecnicoId, nota });
  const resultado = { asignados: [], omitidos: [] };
  for (const codigo of codigos) {
    try {
      const t = getTable('tickets').find((x) => x.codigo === codigo);
      const motivo = t?.tecnicoId ? 'Reasignación en lote' : '';
      await asignar(codigo, tecnicoId, usuario, { nota, motivo });
      resultado.asignados.push(codigo);
    } catch (e) {
      resultado.omitidos.push({ codigo, motivo: e.message });
    }
  }
  return resultado;
}

export async function devolverACola(codigos, usuario, motivo = 'Devuelto a la cola') {
  if (!USE_MOCK) return apiPost('/api/admin/cola/devolver', { codigos, motivo });
  const tickets = getTable('tickets');
  const devueltos = [];
  codigos.forEach((codigo) => {
    const t = tickets.find((x) => x.codigo === codigo);
    if (!t || !t.tecnicoId || !['abierto', 'reabierto', 'en_atencion', 'en_espera'].includes(t.estado)) return;
    const anterior = t.estado;
    guardarAsignacion(t, t.tecnicoId, usuario, 'devolucion', motivo);
    t.tecnicoId = null;
    if (anterior !== 'abierto') {
      t.estado = 'abierto';
      t.motivoEspera = null;
      t.fechaRetorno = null;
      registrarCambioEstado(t.id, anterior, 'abierto', usuario.id, motivo);
    }
    devueltos.push(codigo);
  });
  saveTable('tickets', tickets);
  devueltos.forEach((codigo) => {
    const t = tickets.find((x) => x.codigo === codigo);
    registrarEntrada(t.id, usuario.id, 'interno', `Devuelto a la cola: ${motivo}`);
  });
  return delay({ devueltos }, 300);
}

export async function cambiarPrioridad(codigos, nueva, motivo, usuario) {
  if (!USE_MOCK) return apiPost('/api/admin/cola/prioridad', { codigos, nueva, motivo });
  if (!motivo?.trim()) throw Object.assign(new ApiError('Indica el motivo.', 400), { errores: { motivo: 'El motivo es obligatorio.' } });
  if (!getTable('prioridades').some((p) => p.codigo === nueva)) throw Object.assign(new ApiError('Selecciona la prioridad.', 400), { errores: { nueva: 'Selecciona la nueva prioridad.' } });
  const tickets = getTable('tickets');
  const cambios = getTable('cambiosPrioridad');
  const cambiados = [];
  codigos.forEach((codigo) => {
    const t = tickets.find((x) => x.codigo === codigo);
    if (!t || t.prioridad === nueva || !ESTADOS_COLA.includes(t.estado)) return;
    cambios.push({ id: cambios.reduce((m, c) => Math.max(m, c.id), 0) + 1, ticketId: t.id, anterior: t.prioridad, nueva, motivo: motivo.trim(), autorId: usuario.id, creadoEn: new Date().toISOString() });
    t.prioridad = nueva;
    t.venceEn = new Date(new Date(t.creadoEn).getTime() + horasPorPrioridad(nueva) * 3600000).toISOString();
    cambiados.push(codigo);
  });
  if (!cambiados.length) throw new ApiError('Los tickets seleccionados ya tienen esa prioridad.', 409);
  saveTable('tickets', tickets);
  saveTable('cambiosPrioridad', cambios);
  return delay({ cambiados }, 300);
}

// ---------- Bandeja del técnico ----------
export async function bandejaTecnico(tecnicoId, { estado = '', filtro = 'todos', orden = 'plazo' } = {}) {
  if (!USE_MOCK) return apiGet('/api/admin/bandeja', { estado, filtro, orden });
  const ctx = contextoTickets();
  const mios = getTable('tickets').filter((t) => t.tecnicoId === tecnicoId).map((t) => enriquecerTicket(t, ctx));
  // La bandeja muestra lo vigente y lo cerrado en los últimos 7 días
  const vigentes = mios.filter((t) => t.estado !== 'cancelado' && (t.estado !== 'cerrado' || Date.now() - new Date(t.cerradoEn) < 7 * 86400000));
  const contadores = {
    total: vigentes.filter((t) => ESTADOS_ABIERTOS.includes(t.estado) || t.estado === 'resuelto').length,
    abiertos: vigentes.filter((t) => ['abierto', 'reabierto'].includes(t.estado)).length,
    en_atencion: vigentes.filter((t) => t.estado === 'en_atencion').length,
    en_espera: vigentes.filter((t) => t.estado === 'en_espera').length,
    resuelto: vigentes.filter((t) => t.estado === 'resuelto').length,
    criticos: vigentes.filter((t) => t.prioridad === 'critica' && ESTADOS_ABIERTOS.includes(t.estado)).length,
    vencidos: vigentes.filter((t) => t.vencido).length,
  };
  let lista = vigentes.filter((t) => !estado || t.estado === estado);
  if (filtro === 'criticos') lista = lista.filter((t) => t.prioridad === 'critica' && ESTADOS_ABIERTOS.includes(t.estado));
  if (filtro === 'vencidos') lista = lista.filter((t) => t.vencido);
  if (filtro === 'hoy') lista = lista.filter((t) => esHoy(t.creadoEn));
  // Los cerrados al final
  lista = ordenar(lista, orden).sort((a, b) => Number(a.estado === 'cerrado') - Number(b.estado === 'cerrado'));
  return delay({ lista, contadores });
}

/** Tickets sin asignar de las categorías del técnico (para autoasignarse) */
export async function disponiblesParaTecnico(tecnicoId) {
  if (!USE_MOCK) return apiGet('/api/admin/bandeja/disponibles');
  const categorias = categoriasDeTecnicoSync(tecnicoId);
  const ctx = contextoTickets();
  const lista = getTable('tickets')
    .filter((t) => !t.tecnicoId && ['abierto', 'reabierto'].includes(t.estado) && categorias.includes(t.categoriaId))
    .map((t) => enriquecerTicket(t, ctx));
  return delay(ordenar(lista, 'prioridad'));
}

export async function autoasignar(codigo, tecnico) {
  if (!USE_MOCK) return apiPost(`/api/admin/bandeja/${codigo}/tomar`);
  const tickets = getTable('tickets');
  const t = tickets.find((x) => x.codigo === codigo);
  if (!t) throw new ApiError('No encontramos ese ticket.', 404);
  if (t.tecnicoId) throw new ApiError('Otro técnico ya tomó este ticket.', 409);
  if (!categoriasDeTecnicoSync(tecnico.id).includes(t.categoriaId)) throw new ApiError('No estás habilitado para esta categoría.', 403);
  t.tecnicoId = tecnico.id;
  saveTable('tickets', tickets);
  guardarAsignacion(t, tecnico.id, tecnico, 'autoasignacion', null, null);
  registrarEntrada(t.id, tecnico.id, 'publico', `${nombreCompleto(tecnico)} tomó el ticket.`);
  return delay(enriquecerTicket(t), 300);
}

// ---------- Bandejas de técnicos (supervisor) ----------
export async function bandejasTecnicos() {
  if (!USE_MOCK) return apiGet('/api/admin/bandejas');
  const ctx = contextoTickets();
  const tickets = getTable('tickets').map((t) => enriquecerTicket(t, ctx));
  const categorias = getTable('categorias');
  const tecnicos = ctx.usuarios.filter((u) => u.rol === 'tecnico' && u.estado === 'activo');
  const filas = tecnicos.map((tec) => {
    const activos = tickets.filter((t) => t.tecnicoId === tec.id && ESTADOS_ABIERTOS.includes(t.estado));
    return {
      id: tec.id,
      nombre: nombreCompleto(tec),
      categorias: categoriasDeTecnicoSync(tec.id).map((id) => categorias.find((c) => c.id === id)?.nombre).filter(Boolean),
      en_atencion: activos.filter((t) => t.estado === 'en_atencion').length,
      en_espera: activos.filter((t) => t.estado === 'en_espera').length,
      abiertos: activos.filter((t) => ['abierto', 'reabierto'].includes(t.estado)).length,
      vencidos: activos.filter((t) => t.vencido).length,
      resueltos: tickets.filter((t) => t.tecnicoId === tec.id && t.estado === 'resuelto').length,
      tickets: ordenar(activos, 'plazo'),
    };
  });
  return delay(filas);
}

/** Contador que se muestra en la cabecera según el rol */
export function contadoresCabeceraSync(usuario) {
  if (!usuario) return {};
  const tickets = getTable('tickets');
  if (usuario.rol === 'usuario') {
    const mios = tickets.filter((t) => t.solicitanteId === usuario.id);
    return { misTickets: mios.length, abiertos: mios.filter((t) => ESTADOS_ABIERTOS.includes(t.estado)).length };
  }
  if (usuario.rol === 'tecnico') {
    const mios = tickets.filter((t) => t.tecnicoId === usuario.id);
    const vivos = mios.filter((t) => ESTADOS_ABIERTOS.includes(t.estado) || t.estado === 'resuelto');
    return {
      asignados: vivos.length,
      en_atencion: mios.filter((t) => t.estado === 'en_atencion').length,
      en_espera: mios.filter((t) => t.estado === 'en_espera').length,
      resuelto: mios.filter((t) => t.estado === 'resuelto').length,
    };
  }
  const enCola = tickets.filter((t) => ESTADOS_COLA.includes(t.estado));
  return {
    cola: enCola.length,
    sinAsignar: enCola.filter((t) => !t.tecnicoId && t.estado !== 'resuelto').length,
    tecnicos: getTable('usuarios').filter((u) => u.rol === 'tecnico' && u.estado === 'activo').length,
    categorias: getTable('categorias').filter((c) => c.parentId === null && c.activa).length,
    ambientes: getTable('ambientes').length,
  };
}

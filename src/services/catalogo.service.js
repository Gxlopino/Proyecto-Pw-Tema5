// src/services/catalogo.service.js
// HU-2 · Catálogo de servicios. Dueña de categoría, subcategoría, sede, ambiente y técnico_categoría.
import { USE_MOCK, getTable, saveTable, nextId, delay, ApiError, apiGet, apiPost, apiPut, apiDelete } from './api.client';
import { nombreCompleto, listarUsuariosSync } from './auth.service';

export const ESTADOS_ABIERTOS = ['abierto', 'en_atencion', 'en_espera', 'reabierto'];

export const TIPOS_AMBIENTE = [
  { codigo: 'aula', nombre: 'Aula' },
  { codigo: 'aula_magna', nombre: 'Aula magna' },
  { codigo: 'laboratorio', nombre: 'Laboratorio' },
  { codigo: 'auditorio', nombre: 'Auditorio' },
  { codigo: 'biblioteca', nombre: 'Biblioteca' },
  { codigo: 'otro', nombre: 'Otro' },
];

export function nombreTipoAmbiente(codigo) {
  return TIPOS_AMBIENTE.find((t) => t.codigo === codigo)?.nombre || codigo;
}

// ---------- Lecturas síncronas para otras historias ----------
export function prioridadesSync() {
  return getTable('prioridades');
}

export function horasPorPrioridad(codigo) {
  return prioridadesSync().find((p) => p.codigo === codigo)?.horas ?? 24;
}

export function categoriasSync() {
  return getTable('categorias');
}

export function ambientesSync() {
  return getTable('ambientes');
}

export function sedesSync() {
  return getTable('sedes');
}

function contarAbiertos(tickets, campo, id) {
  return tickets.filter((t) => t[campo] === id && ESTADOS_ABIERTOS.includes(t.estado)).length;
}

// ---------- Categorías ----------
/** Árbol de dos niveles: categoría con sus subcategorías y tickets abiertos */
export async function listarCategorias({ busqueda = '', soloActivas = false, prioridad = '' } = {}) {
  if (!USE_MOCK) return apiGet('/api/admin/categorias', { busqueda, soloActivas, prioridad });
  const categorias = getTable('categorias');
  const tickets = getTable('tickets');
  const texto = busqueda.trim().toLowerCase();

  const arbol = categorias
    .filter((c) => c.parentId === null)
    .map((c) => {
      const subcategorias = categorias
        .filter((s) => s.parentId === c.id)
        .map((s) => ({ ...s, ticketsAbiertos: contarAbiertos(tickets, 'subcategoriaId', s.id) }));
      return { ...c, ticketsAbiertos: contarAbiertos(tickets, 'categoriaId', c.id), subcategorias };
    })
    .map((c) => {
      const padreCoincideTexto = !texto || c.nombre.toLowerCase().includes(texto);
      const pasaFiltros = (x) => (!soloActivas || x.activa) && (!prioridad || x.prioridadDefecto === prioridad);
      const subs = c.subcategorias.filter((s) => pasaFiltros(s) && (padreCoincideTexto || s.nombre.toLowerCase().includes(texto)));
      const padreVisible = padreCoincideTexto && pasaFiltros(c);
      return padreVisible || subs.length ? { ...c, subcategorias: subs } : null;
    })
    .filter(Boolean);
  return delay(arbol);
}

export async function obtenerCategoria(id) {
  if (!USE_MOCK) return apiGet(`/api/admin/categorias/${id}`);
  const cat = getTable('categorias').find((c) => c.id === Number(id));
  if (!cat) throw new ApiError('La categoría no existe.', 404);
  return delay(cat, 100);
}

export function validarCategoria(data, categorias = categoriasSync()) {
  const errores = {};
  const nombre = (data.nombre || '').trim();
  if (!nombre) errores.nombre = 'El nombre es obligatorio.';
  else if (nombre.length > 60) errores.nombre = 'Máximo 60 caracteres.';
  else if (categorias.some((c) => c.id !== data.id && (c.parentId ?? null) === (data.parentId ?? null) && c.nombre.toLowerCase() === nombre.toLowerCase())) {
    errores.nombre = 'Ya existe una categoría con ese nombre en el mismo nivel.';
  }
  if (!data.prioridadDefecto) errores.prioridadDefecto = 'Selecciona la prioridad por defecto.';
  const horas = Number(data.tiempoEsperadoHoras);
  if (!Number.isFinite(horas) || horas <= 0) errores.tiempoEsperadoHoras = 'Debe ser un número mayor que cero.';
  if ((data.descripcion || '').length > 240) errores.descripcion = 'Máximo 240 caracteres.';
  if (data.parentId && data.id && categorias.some((c) => c.parentId === data.id)) {
    errores.parentId = 'Esta categoría tiene subcategorías; no puede pasar a ser subcategoría.';
  }
  return errores;
}

export async function guardarCategoria(data) {
  if (!USE_MOCK) return data.id ? apiPut(`/api/admin/categorias/${data.id}`, data) : apiPost('/api/admin/categorias', data);
  const categorias = getTable('categorias');
  const registro = {
    ...data,
    nombre: (data.nombre || '').trim(),
    parentId: data.parentId ? Number(data.parentId) : null,
    tiempoEsperadoHoras: Number(data.tiempoEsperadoHoras),
    descripcion: (data.descripcion || '').trim(),
    activa: !!data.activa,
  };
  const errores = validarCategoria(registro, categorias);
  if (Object.keys(errores).length) throw Object.assign(new ApiError('No se pudo guardar: revisa los campos marcados.', 400), { errores });

  if (registro.id) {
    const idx = categorias.findIndex((c) => c.id === registro.id);
    if (idx < 0) throw new ApiError('La categoría no existe.', 404);
    categorias[idx] = { ...categorias[idx], ...registro };
  } else {
    registro.id = nextId('categorias');
    categorias.push(registro);
  }
  saveTable('categorias', categorias);
  return delay(registro, 400);
}

/** Tickets en curso de una categoría (o subcategoría) y sus hijas */
export function ticketsEnCursoDeCategoria(id) {
  const categorias = categoriasSync();
  const ids = [id, ...categorias.filter((c) => c.parentId === id).map((c) => c.id)];
  return getTable('tickets').filter((t) => (ids.includes(t.categoriaId) || ids.includes(t.subcategoriaId)) && ESTADOS_ABIERTOS.includes(t.estado)).length;
}

export async function cambiarEstadoCategoria(id, activa) {
  if (!USE_MOCK) return apiPut(`/api/admin/categorias/${id}/estado`, { activa });
  const categorias = getTable('categorias');
  const cat = categorias.find((c) => c.id === id);
  if (!cat) throw new ApiError('La categoría no existe.', 404);
  cat.activa = activa;
  // Desactivar una categoría desactiva también sus subcategorías
  if (!activa) categorias.filter((c) => c.parentId === id).forEach((c) => { c.activa = false; });
  saveTable('categorias', categorias);
  return delay(cat, 300);
}

export async function eliminarCategoria(id) {
  if (!USE_MOCK) return apiDelete(`/api/admin/categorias/${id}`);
  const categorias = getTable('categorias');
  const tieneTickets = getTable('tickets').some((t) => t.categoriaId === id || t.subcategoriaId === id);
  if (tieneTickets) throw new ApiError('No se puede eliminar: la categoría ya tiene tickets registrados. Desactívala en su lugar.', 409);
  if (categorias.some((c) => c.parentId === id)) throw new ApiError('Primero elimina o mueve sus subcategorías.', 409);
  saveTable('categorias', categorias.filter((c) => c.id !== id));
  saveTable('tecnicoCategorias', getTable('tecnicoCategorias').filter((tc) => tc.categoriaId !== id));
  return delay(true, 300);
}

// ---------- Sedes y ambientes ----------
export async function listarSedes() {
  if (!USE_MOCK) return apiGet('/api/admin/sedes');
  return delay(getTable('sedes'), 50);
}

export async function listarAmbientes({ busqueda = '', sedeId = '', pabellon = '', tipo = '' } = {}) {
  if (!USE_MOCK) return apiGet('/api/admin/ambientes', { busqueda, sedeId, pabellon, tipo });
  const tickets = getTable('tickets');
  const sedes = getTable('sedes');
  const texto = busqueda.trim().toLowerCase();
  const lista = getTable('ambientes')
    .filter((a) => !texto || a.codigo.toLowerCase().includes(texto) || a.nombre.toLowerCase().includes(texto))
    .filter((a) => !sedeId || a.sedeId === Number(sedeId))
    .filter((a) => !pabellon || a.pabellon === pabellon)
    .filter((a) => !tipo || a.tipo === tipo)
    .map((a) => ({ ...a, sede: sedes.find((s) => s.id === a.sedeId)?.nombre, ticketsAbiertos: contarAbiertos(tickets, 'ambienteId', a.id) }));
  return delay(lista);
}

export function validarAmbiente(data, ambientes = ambientesSync()) {
  const errores = {};
  const codigo = (data.codigo || '').trim().toUpperCase();
  if (!codigo) errores.codigo = 'El código es obligatorio.';
  else if (!/^[A-Z0-9-]{2,15}$/.test(codigo)) errores.codigo = 'Usa letras, números y guiones (máx. 15).';
  else if (ambientes.some((a) => a.id !== data.id && a.codigo === codigo)) errores.codigo = 'Ya existe un ambiente con ese código.';
  if (!(data.nombre || '').trim()) errores.nombre = 'El nombre es obligatorio.';
  if (!data.tipo) errores.tipo = 'Selecciona el tipo.';
  if (!data.sedeId) errores.sedeId = 'Selecciona la sede.';
  if (!(data.pabellon || '').trim()) errores.pabellon = 'Indica el pabellón.';
  if (data.piso === '' || !Number.isInteger(Number(data.piso))) errores.piso = 'Indica el piso.';
  if (!(Number(data.capacidad) > 0)) errores.capacidad = 'Debe ser mayor que cero.';
  return errores;
}

export async function guardarAmbiente(data) {
  if (!USE_MOCK) return data.id ? apiPut(`/api/admin/ambientes/${data.id}`, data) : apiPost('/api/admin/ambientes', data);
  const ambientes = getTable('ambientes');
  const errores = validarAmbiente(data, ambientes);
  if (Object.keys(errores).length) throw Object.assign(new ApiError('Revisa los campos marcados.', 400), { errores });
  const registro = {
    id: data.id || nextId('ambientes'),
    codigo: data.codigo.trim().toUpperCase(),
    nombre: data.nombre.trim(),
    tipo: data.tipo,
    pabellon: data.pabellon.trim(),
    piso: Number(data.piso),
    sedeId: Number(data.sedeId),
    capacidad: Number(data.capacidad),
    activo: data.activo !== false,
  };
  const idx = ambientes.findIndex((a) => a.id === registro.id);
  if (idx >= 0) ambientes[idx] = registro; else ambientes.push(registro);
  saveTable('ambientes', ambientes);
  return delay(registro, 300);
}

export async function eliminarAmbiente(id) {
  if (!USE_MOCK) return apiDelete(`/api/admin/ambientes/${id}`);
  if (getTable('tickets').some((t) => t.ambienteId === id)) {
    throw new ApiError('No se puede eliminar: el ambiente tiene tickets registrados.', 409);
  }
  saveTable('ambientes', getTable('ambientes').filter((a) => a.id !== id));
  return delay(true, 300);
}

// ---------- Técnicos por categoría ----------
export async function obtenerMatrizTecnicos() {
  if (!USE_MOCK) return apiGet('/api/admin/tecnico-categorias');
  const tecnicos = listarUsuariosSync({ rol: 'tecnico' }).filter((t) => t.estado === 'activo');
  const relaciones = getTable('tecnicoCategorias');
  const categorias = getTable('categorias').filter((c) => c.parentId === null);
  const tickets = getTable('tickets');
  const filas = tecnicos.map((t) => ({
    id: t.id,
    nombre: nombreCompleto(t),
    especialidadDeclarada: t.especialidades.map((id) => categorias.find((c) => c.id === id)?.nombre).filter(Boolean),
    carga: tickets.filter((x) => x.tecnicoId === t.id && ESTADOS_ABIERTOS.includes(x.estado)).length,
    categorias: relaciones.filter((r) => r.tecnicoId === t.id).map((r) => r.categoriaId),
  }));
  return delay({ categorias, filas });
}

/** asignaciones = { [tecnicoId]: [categoriaId, ...] } */
export async function guardarMatrizTecnicos(asignaciones) {
  if (!USE_MOCK) return apiPut('/api/admin/tecnico-categorias', asignaciones);
  const relaciones = Object.entries(asignaciones).flatMap(([tecnicoId, cats]) => cats.map((categoriaId) => ({ tecnicoId: Number(tecnicoId), categoriaId })));
  saveTable('tecnicoCategorias', relaciones);
  return delay(true, 400);
}

/** Lectura usada por HU-4: técnicos habilitados para una categoría */
export function tecnicosHabilitadosSync(categoriaId) {
  const ids = getTable('tecnicoCategorias').filter((r) => r.categoriaId === categoriaId).map((r) => r.tecnicoId);
  return listarUsuariosSync({ rol: 'tecnico' }).filter((t) => t.estado === 'activo' && ids.includes(t.id));
}

export function categoriasDeTecnicoSync(tecnicoId) {
  return getTable('tecnicoCategorias').filter((r) => r.tecnicoId === tecnicoId).map((r) => r.categoriaId);
}

/** Resumen del ambiente que se muestra en el detalle del ticket */
export function resumenAmbienteSync(ambienteId) {
  const tickets = getTable('tickets').filter((t) => t.ambienteId === ambienteId);
  const ultimoCierre = tickets.filter((t) => t.cerradoEn).sort((a, b) => new Date(b.cerradoEn) - new Date(a.cerradoEn))[0];
  return { abiertos: tickets.filter((t) => ESTADOS_ABIERTOS.includes(t.estado)).length, ultimoCierre: ultimoCierre?.cerradoEn || null };
}

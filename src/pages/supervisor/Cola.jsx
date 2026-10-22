// HU-4 · 4.1 Cola de atención · 4.2 asignar · 4.3 cambiar prioridad · 4.4 acciones en lote · Supervisor
// src/pages/supervisor/Cola.jsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { EstadoBadge, PrioridadBadge, LISTA_PRIORIDADES, nombreEstado, nombrePrioridad } from '../../widgets/Badges';
import Modal from '../../widgets/Modal';
import ConfirmDialog from '../../widgets/ConfirmDialog';
import EmptyState from '../../widgets/EmptyState';
import FormField, { inputClass } from '../../widgets/FormField';
import Paginacion, { paginar } from '../../widgets/Paginacion';
import { useAuth } from '../../context/AuthContext';
import { listarCola, resumenColaSync, tecnicosParaCategoria, cargaTecnicosSync, asignar, asignarLote, devolverACola, cambiarPrioridad, ESTADOS_COLA } from '../../services/cola.service';
import { categoriasSync, ambientesSync, horasPorPrioridad } from '../../services/catalogo.service';
import { haceCuanto } from '../../helpers/datetime';

const FILTROS = { busqueda: '', prioridades: [], estados: [], categoriaId: '', ambienteId: '', orden: 'antiguedad' };
const ORDENES = [
  { codigo: 'antiguedad', nombre: 'antigüedad (recientes)' },
  { codigo: 'mas_antiguos', nombre: 'más antiguos primero' },
  { codigo: 'prioridad', nombre: 'prioridad' },
  { codigo: 'sin_atencion', nombre: 'tiempo sin atención' },
];

function MultiFiltro({ etiqueta, opciones, valores, onChange }) {
  const texto = valores.length ? `${etiqueta}: ${valores.map((v) => opciones.find((o) => o.codigo === v)?.nombre.toLowerCase()).join(', ')}` : `${etiqueta}: todos`;
  const toggle = (codigo) => onChange(valores.includes(codigo) ? valores.filter((v) => v !== codigo) : [...valores, codigo]);
  return (
    <div className="dropdown">
      <button type="button" className={`btn btn-sm dropdown-toggle ${valores.length ? 'filter-chip' : 'btn-outline-secondary'}`} data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false">{texto}</button>
      <div className="dropdown-menu p-2" style={{ minWidth: 200 }}>
        {opciones.map((o) => (
          <div className="form-check" key={o.codigo}>
            <input className="form-check-input" type="checkbox" id={`${etiqueta}-${o.codigo}`} checked={valores.includes(o.codigo)} onChange={() => toggle(o.codigo)} />
            <label className="form-check-label small" htmlFor={`${etiqueta}-${o.codigo}`}>{o.nombre}</label>
          </div>
        ))}
        {valores.length > 0 && <button type="button" className="btn btn-link btn-sm p-0 mt-1" onClick={() => onChange([])}>Quitar</button>}
      </div>
    </div>
  );
}

export default function Cola() {
  const { usuario } = useAuth();
  const [filtros, setFiltros] = useState(FILTROS);
  const [lista, setLista] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [pagina, setPagina] = useState(1);
  const [seleccion, setSeleccion] = useState([]);
  const [resumen, setResumen] = useState(resumenColaSync());
  const [modalAsignar, setModalAsignar] = useState(null);
  const [modalPrioridad, setModalPrioridad] = useState(null);
  const [modalDevolver, setModalDevolver] = useState(null);
  const [form, setForm] = useState({});
  const [errores, setErrores] = useState({});
  const categorias = useMemo(() => categoriasSync().filter((c) => c.parentId === null), []);
  const ambientes = useMemo(() => ambientesSync(), []);
  const info = paginar(lista, pagina, 15);
  const hayFiltros = JSON.stringify({ ...filtros, orden: '' }) !== JSON.stringify({ ...FILTROS, orden: '' });

  const cargar = useCallback(() => {
    setCargando(true);
    listarCola(filtros).then((l) => {
      setLista(l);
      setSeleccion((s) => s.filter((c) => l.some((t) => t.codigo === c)));
      setResumen(resumenColaSync());
    }).finally(() => setCargando(false));
  }, [filtros]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { setPagina(1); }, [filtros]);

  const set = (campo, valor) => setFiltros((f) => ({ ...f, [campo]: valor }));
  const toggleSel = (codigo) => setSeleccion((s) => (s.includes(codigo) ? s.filter((c) => c !== codigo) : [...s, codigo]));
  const codigosPagina = info.items.map((t) => t.codigo);
  const todosPagina = codigosPagina.length > 0 && codigosPagina.every((c) => seleccion.includes(c));
  const toggleTodos = () => setSeleccion((s) => (todosPagina ? s.filter((c) => !codigosPagina.includes(c)) : [...new Set([...s, ...codigosPagina])]));
  const seleccionados = lista.filter((t) => seleccion.includes(t.codigo));

  // ----- Asignar -----
  const abrirAsignar = (tickets) => {
    setErrores({});
    const unico = tickets.length === 1 ? tickets[0] : null;
    setForm({ tecnicoId: '', nota: '', motivo: '' });
    setModalAsignar({ tickets, unico, opciones: unico ? tecnicosParaCategoria(unico.categoriaId) : cargaTecnicosSync() });
  };

  const confirmarAsignar = async () => {
    setErrores({});
    try {
      if (modalAsignar.unico) {
        const t = await asignar(modalAsignar.unico.codigo, form.tecnicoId, usuario, form);
        toast.success(`${t.codigo} asignado a ${t.tecnico}.`);
      } else {
        if (!form.tecnicoId) { setErrores({ tecnicoId: 'Selecciona un técnico.' }); return; }
        const r = await asignarLote(modalAsignar.tickets.map((t) => t.codigo), Number(form.tecnicoId), usuario, form.nota);
        if (r.asignados.length) toast.success(`${r.asignados.length} tickets asignados.`);
        if (r.omitidos.length) toast.warning(`${r.omitidos.length} omitidos: ${r.omitidos.map((o) => `${o.codigo} (${o.motivo})`).join('; ')}`, { autoClose: 7000 });
      }
      setModalAsignar(null);
      setSeleccion([]);
      cargar();
    } catch (ex) {
      if (ex.errores) setErrores(ex.errores);
      toast.error(ex.message);
    }
  };

  // ----- Prioridad -----
  const abrirPrioridad = (tickets) => {
    setErrores({});
    setForm({ nueva: '', motivo: '' });
    setModalPrioridad({ tickets, unico: tickets.length === 1 ? tickets[0] : null });
  };

  const confirmarPrioridad = async () => {
    setErrores({});
    try {
      const r = await cambiarPrioridad(modalPrioridad.tickets.map((t) => t.codigo), form.nueva, form.motivo, usuario);
      toast.success(`Prioridad actualizada en ${r.cambiados.length} ticket${r.cambiados.length > 1 ? 's' : ''}.`);
      setModalPrioridad(null);
      setSeleccion([]);
      cargar();
    } catch (ex) {
      if (ex.errores) setErrores(ex.errores);
      toast.error(ex.message);
    }
  };

  // ----- Devolver -----
  const confirmarDevolver = async () => {
    const r = await devolverACola(modalDevolver.map((t) => t.codigo), usuario, form.motivo?.trim() || 'Devuelto a la cola por el supervisor');
    if (r.devueltos.length) toast.success(`${r.devueltos.length} tickets volvieron a la cola.`);
    else toast.info('Ninguno de los tickets seleccionados tenía técnico asignado.');
    setModalDevolver(null);
    setSeleccion([]);
    cargar();
  };

  const unicoPrioridad = modalPrioridad?.unico;
  const horasAntes = unicoPrioridad ? Math.round((new Date(unicoPrioridad.venceEn) - new Date(unicoPrioridad.creadoEn)) / 3600000) : null;

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
        <div>
          <h1 className="mb-1">Cola de atención</h1>
          <p className="text-muted mb-0">{resumen.total} tickets en cola · {resumen.sinAsignar} sin asignar · {resumen.fueraDeTiempo} fuera del tiempo esperado</p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <button type="button" className="stat-pill" style={{ color: 'var(--color-info)' }} onClick={() => set('estados', ['abierto', 'reabierto'])}>Abiertos {resumen.abiertos}</button>
          <button type="button" className="stat-pill" style={{ color: 'var(--color-warning)' }} onClick={() => set('estados', ['en_atencion'])}>En atención {resumen.enAtencion}</button>
          <button type="button" className="stat-pill" style={{ color: 'var(--color-text-muted)' }} onClick={() => set('estados', ['en_espera'])}>En espera {resumen.enEspera}</button>
          <span className="stat-pill" style={{ color: 'var(--color-success)' }}>Resueltos hoy {resumen.resueltosHoy}</span>
        </div>
      </div>

      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <input className="form-control form-control-sm" style={{ maxWidth: 240 }} placeholder="Buscar código, asunto o usuario" value={filtros.busqueda} onChange={(e) => set('busqueda', e.target.value)} aria-label="Buscar en la cola" />
        <MultiFiltro etiqueta="Prioridad" opciones={LISTA_PRIORIDADES} valores={filtros.prioridades} onChange={(v) => set('prioridades', v)} />
        <MultiFiltro etiqueta="Estado" opciones={ESTADOS_COLA.map((e) => ({ codigo: e, nombre: nombreEstado(e) }))} valores={filtros.estados} onChange={(v) => set('estados', v)} />
        <select className="form-select form-select-sm" style={{ maxWidth: 190 }} value={filtros.categoriaId} onChange={(e) => set('categoriaId', e.target.value)} aria-label="Categoría">
          <option value="">Categoría: todas</option>
          {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <select className="form-select form-select-sm" style={{ maxWidth: 170 }} value={filtros.ambienteId} onChange={(e) => set('ambienteId', e.target.value)} aria-label="Ambiente">
          <option value="">Ambiente: todos</option>
          {ambientes.map((a) => <option key={a.id} value={a.id}>{a.codigo}</option>)}
        </select>
        {hayFiltros && <button type="button" className="btn btn-link btn-sm" onClick={() => setFiltros({ ...FILTROS, orden: filtros.orden })}>Limpiar filtros</button>}
        <select className="form-select form-select-sm ms-auto" style={{ maxWidth: 220 }} value={filtros.orden} onChange={(e) => set('orden', e.target.value)} aria-label="Orden">
          {ORDENES.map((o) => <option key={o.codigo} value={o.codigo}>Orden: {o.nombre}</option>)}
        </select>
      </div>

      <div className="card">
        {cargando ? <div className="text-center py-5"><span className="spinner-border text-primary" /></div>
          : lista.length === 0 ? (
            <EmptyState title="No hay tickets con estos filtros" message={hayFiltros ? 'La cola está al día para los filtros elegidos.' : 'No hay tickets pendientes en la cola.'} action={hayFiltros && <button type="button" className="btn btn-primary" onClick={() => setFiltros(FILTROS)}>Quitar filtros</button>} />
          ) : (
            <>
              <div className="table-responsive">
                <table className="table table-app">
                  <thead>
                    <tr>
                      <th className="prio-bar" />
                      <th><input type="checkbox" className="form-check-input" checked={todosPagina} onChange={toggleTodos} aria-label="Seleccionar todos" /></th>
                      <th>Código</th><th>Asunto · Categoría · Ambiente</th><th>Solicitante</th><th>Antigüedad</th><th>Prioridad</th><th>Estado</th><th>Técnico</th><th className="text-end">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {info.items.map((t) => (
                      <tr key={t.id} className={seleccion.includes(t.codigo) ? 'row-selected' : ''}>
                        <td className={`prio-bar prio-bar-${t.prioridad}`} />
                        <td><input type="checkbox" className="form-check-input" checked={seleccion.includes(t.codigo)} onChange={() => toggleSel(t.codigo)} aria-label={`Seleccionar ${t.codigo}`} /></td>
                        <td><Link to={`/supervisor/tickets/${t.codigo}`} className="ticket-code small">{t.codigo}</Link></td>
                        <td style={{ minWidth: 230 }}>{t.asunto}<div className="small text-muted">{t.categoria} · {t.subcategoria} · <span className="font-mono">{t.ambiente}</span></div></td>
                        <td className="small" style={{ minWidth: 120 }}>{t.solicitante}</td>
                        <td className={`small text-nowrap ${t.vencido ? 'text-danger fw-semibold' : ''}`} title={t.vencido ? 'Fuera del tiempo esperado' : ''}>{haceCuanto(t.creadoEn)}</td>
                        <td><PrioridadBadge prioridad={t.prioridad} /></td>
                        <td><EstadoBadge estado={t.estado} /></td>
                        <td className="small text-nowrap">{t.tecnico || <span className="text-muted">Sin asignar</span>}</td>
                        <td className="text-end">
                          <div className="dropdown">
                            <button type="button" className="btn btn-sm btn-outline-primary dropdown-toggle" data-bs-toggle="dropdown" data-bs-popper-config='{"strategy":"fixed"}' aria-expanded="false" aria-label={`Acciones de ${t.codigo}`}>Acciones</button>
                            <ul className="dropdown-menu dropdown-menu-end">
                              {t.estado !== 'resuelto' && <li><button type="button" className="dropdown-item" onClick={() => abrirAsignar([t])}>{t.tecnicoId ? 'Reasignar técnico' : 'Asignar técnico'}</button></li>}
                              <li><button type="button" className="dropdown-item" onClick={() => abrirPrioridad([t])}>Cambiar prioridad</button></li>
                              {t.tecnicoId && t.estado !== 'resuelto' && <li><button type="button" className="dropdown-item" onClick={() => { setForm({ motivo: '' }); setModalDevolver([t]); }}>Devolver a la cola</button></li>}
                              <li><Link className="dropdown-item" to={`/supervisor/tickets/${t.codigo}/historial`}>Ver historial</Link></li>
                            </ul>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Paginacion info={info} onChange={setPagina} etiqueta="tickets" />
            </>
          )}
      </div>

      {seleccion.length > 0 && (
        <div className="bulk-bar d-flex flex-wrap align-items-center gap-2 p-2 px-3 mt-3 mx-auto" style={{ width: 'fit-content', maxWidth: '100%' }}>
          <strong className="small me-2">{seleccion.length} tickets seleccionados</strong>
          <button type="button" className="btn btn-sm btn-light" onClick={() => abrirAsignar(seleccionados)}>Asignar a técnico</button>
          <button type="button" className="btn btn-sm btn-outline-light" onClick={() => abrirPrioridad(seleccionados)}>Cambiar prioridad</button>
          <button type="button" className="btn btn-sm btn-outline-light" onClick={() => { setForm({ motivo: '' }); setModalDevolver(seleccionados); }}>Devolver a la cola</button>
          <button type="button" className="btn btn-sm btn-link text-white" onClick={() => setSeleccion([])}>Quitar selección</button>
        </div>
      )}

      {/* 4.2 Asignar técnico */}
      <Modal
        show={!!modalAsignar}
        title={modalAsignar?.unico ? `${modalAsignar.unico.tecnicoId ? 'Reasignar' : 'Asignar'} ${modalAsignar.unico.codigo}` : `Asignar ${modalAsignar?.tickets.length} tickets`}
        subtitle={modalAsignar?.unico ? `${modalAsignar.unico.categoria} · ${modalAsignar.unico.ambiente} · prioridad ${nombrePrioridad(modalAsignar.unico.prioridad).toLowerCase()}` : 'Solo se asignan los tickets de categorías que el técnico atiende.'}
        onClose={() => setModalAsignar(null)}
        footer={(
          <>
            <button type="button" className="btn btn-outline-primary" onClick={() => setModalAsignar(null)}>Cancelar</button>
            <button type="button" className="btn btn-primary" onClick={confirmarAsignar}>Asignar</button>
          </>
        )}
      >
        {modalAsignar && (
          <>
            <div className="form-label">Técnico habilitado</div>
            {modalAsignar.unico && modalAsignar.opciones.length === 0 && <div className="alert alert-warning small">Ningún técnico está habilitado para {modalAsignar.unico.categoria}. Habilítalo en «Técnicos por categoría».</div>}
            <div className="d-flex flex-column gap-2 mb-3">
              {modalAsignar.opciones.map((op) => {
                const actual = modalAsignar.unico?.tecnicoId === op.id;
                return (
                  <button type="button" key={op.id} disabled={actual} className={`option-card text-start d-flex justify-content-between ${Number(form.tecnicoId) === op.id ? 'selected' : ''} ${actual ? 'disabled' : ''}`} onClick={() => setForm({ ...form, tecnicoId: op.id })}>
                    <span className="fw-medium">{op.nombre}{actual ? ' (actual)' : ''}</span>
                    {<span className="small text-muted">{op.carga} tickets · {op.criticos} críticos</span>}
                  </button>
                );
              })}
            </div>
            {errores.tecnicoId && <div className="invalid-feedback d-block mb-2">{errores.tecnicoId}</div>}
            {modalAsignar.unico?.tecnicoId && (
              <FormField id="motivoReasignar" label="Motivo de la reasignación (obligatorio)" error={errores.motivo}>
                <input id="motivoReasignar" className={inputClass(errores.motivo)} value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} />
              </FormField>
            )}
            <FormField id="nota" label="Nota para el técnico" className="">
              <textarea id="nota" rows={2} className="form-control" value={form.nota} onChange={(e) => setForm({ ...form, nota: e.target.value })} placeholder="Hay clase de 10:00 a 13:00; atender antes de esa hora." />
            </FormField>
          </>
        )}
      </Modal>

      {/* 4.3 Cambiar prioridad */}
      <Modal
        show={!!modalPrioridad}
        title={unicoPrioridad ? `Cambiar prioridad de ${unicoPrioridad.codigo}` : `Cambiar prioridad de ${modalPrioridad?.tickets.length} tickets`}
        onClose={() => setModalPrioridad(null)}
        footer={(
          <>
            <button type="button" className="btn btn-outline-primary" onClick={() => setModalPrioridad(null)}>Cancelar</button>
            <button type="button" className="btn btn-primary" onClick={confirmarPrioridad}>Guardar prioridad</button>
          </>
        )}
      >
        {modalPrioridad && (
          <>
            <div className="d-flex align-items-end gap-3 mb-3">
              {unicoPrioridad && <div><div className="form-label">Actual</div><PrioridadBadge prioridad={unicoPrioridad.prioridad} /></div>}
              {unicoPrioridad && <span className="pb-1">→</span>}
              <div className="flex-grow-1">
                <div className="form-label">Nueva</div>
                <div className="btn-group flex-wrap" role="group">
                  {LISTA_PRIORIDADES.map((p) => (
                    <React.Fragment key={p.codigo}>
                      <input type="radio" className="btn-check" id={`np-${p.codigo}`} checked={form.nueva === p.codigo} onChange={() => setForm({ ...form, nueva: p.codigo })} disabled={unicoPrioridad?.prioridad === p.codigo} />
                      <label className="btn btn-sm btn-outline-primary" htmlFor={`np-${p.codigo}`}>{p.nombre}</label>
                    </React.Fragment>
                  ))}
                </div>
                {errores.nueva && <div className="invalid-feedback d-block">{errores.nueva}</div>}
              </div>
            </div>
            <FormField id="motivoPrioridad" label="Motivo (obligatorio)" error={errores.motivo}>
              <textarea id="motivoPrioridad" rows={2} className={inputClass(errores.motivo)} value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} placeholder="Afecta al auditorio con evento institucional mañana a las 09:00." />
            </FormField>
            {form.nueva && unicoPrioridad && (
              <div className="alert alert-warning small mb-0">
                Su tiempo esperado pasará de {horasAntes} h a {horasPorPrioridad(form.nueva)} h desde el registro{horasPorPrioridad(form.nueva) < horasAntes ? ' y el ticket subirá en la cola' : ''}.
              </div>
            )}
          </>
        )}
      </Modal>

      {/* Devolver a la cola (confirmación destructiva) */}
      <ConfirmDialog
        show={!!modalDevolver}
        title={modalDevolver?.length === 1 ? `¿Devolver ${modalDevolver[0].codigo} a la cola?` : `¿Devolver ${modalDevolver?.length} tickets a la cola?`}
        message="Se quitará el técnico asignado y los tickets volverán al estado Abierto. La bitácora conserva el historial."
        confirmLabel="Devolver a la cola"
        onConfirm={confirmarDevolver}
        onCancel={() => setModalDevolver(null)}
      >
        <FormField id="motivoDevolver" label="Motivo" className="">
          <input id="motivoDevolver" className="form-control" value={form.motivo || ''} onChange={(e) => setForm({ ...form, motivo: e.target.value })} placeholder="Redistribución de carga" />
        </FormField>
      </ConfirmDialog>
    </>
  );
}

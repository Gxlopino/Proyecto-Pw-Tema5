// HU-2 · 2.1 Categorías y subcategorías · Supervisor
// src/pages/supervisor/Categorias.jsx
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTags } from '@fortawesome/free-solid-svg-icons';
import { PrioridadBadge, LISTA_PRIORIDADES } from '../../widgets/Badges';
import ConfirmDialog from '../../widgets/ConfirmDialog';
import EmptyState from '../../widgets/EmptyState';
import { listarCategorias, cambiarEstadoCategoria, eliminarCategoria, ticketsEnCursoDeCategoria, categoriasSync } from '../../services/catalogo.service';

const FILTROS_INICIALES = { busqueda: '', soloActivas: false, prioridad: '' };

export default function Categorias() {
  const navigate = useNavigate();
  const [filtros, setFiltros] = useState(FILTROS_INICIALES);
  const [arbol, setArbol] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [confirmacion, setConfirmacion] = useState(null);
  const todas = categoriasSync();
  const totalCategorias = todas.filter((c) => c.parentId === null).length;
  const activas = todas.filter((c) => c.parentId === null && c.activa).length;
  const totalSubs = todas.filter((c) => c.parentId !== null).length;
  const filtrosActivos = [filtros.busqueda, filtros.soloActivas, filtros.prioridad].filter(Boolean).length;

  const cargar = useCallback(() => {
    setCargando(true);
    listarCategorias(filtros).then(setArbol).finally(() => setCargando(false));
  }, [filtros]);

  useEffect(() => { cargar(); }, [cargar]);

  const pedirCambioEstado = (cat) => {
    if (cat.activa) {
      const enCurso = ticketsEnCursoDeCategoria(cat.id);
      setConfirmacion({ tipo: 'desactivar', cat, enCurso });
    } else {
      cambiarEstadoCategoria(cat.id, true).then(() => { toast.success(`"${cat.nombre}" está activa otra vez.`); cargar(); });
    }
  };

  const confirmar = async () => {
    const { tipo, cat } = confirmacion;
    try {
      if (tipo === 'desactivar') {
        await cambiarEstadoCategoria(cat.id, false);
        toast.success(`"${cat.nombre}" quedó inactiva. Ya no admite tickets nuevos.`);
      } else {
        await eliminarCategoria(cat.id);
        toast.success(`"${cat.nombre}" fue eliminada.`);
      }
      setConfirmacion(null);
      cargar();
    } catch (ex) {
      toast.error(ex.message);
      setConfirmacion(null);
    }
  };

  const fila = (c, esSub) => (
    <tr key={c.id} className={!c.activa ? 'text-muted' : ''}>
      <td className={esSub ? 'ps-5' : 'fw-semibold'}>{esSub && <span className="text-muted me-2">└</span>}{c.nombre}</td>
      <td><PrioridadBadge prioridad={c.prioridadDefecto} /></td>
      <td>{c.tiempoEsperadoHoras} h hábiles</td>
      <td className="text-center">{c.ticketsAbiertos}</td>
      <td><span className={`tag tag-${c.activa ? 'activa' : 'inactiva'}`}>{c.activa ? 'Activa' : 'Inactiva'}</span></td>
      <td className="text-end text-nowrap">
        {!esSub && <Link to={`/supervisor/categorias/nueva?parent=${c.id}`} className="btn btn-sm btn-tertiary">+ Subcategoría</Link>}
        <Link to={`/supervisor/categorias/${c.id}`} className="btn btn-sm btn-tertiary">Editar</Link>
        <button type="button" className="btn btn-sm btn-tertiary" onClick={() => pedirCambioEstado(c)}>{c.activa ? 'Desactivar' : 'Activar'}</button>
        <button type="button" className="btn btn-sm btn-tertiary text-danger" onClick={() => setConfirmacion({ tipo: 'eliminar', cat: c })}>Eliminar</button>
      </td>
    </tr>
  );

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
        <div>
          <h1 className="mb-1">Categorías de servicio</h1>
          <p className="text-muted mb-0">{activas} categorías activas · {totalSubs} subcategorías · la prioridad por defecto se aplica a cada ticket nuevo.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => navigate('/supervisor/categorias/nueva')}><FontAwesomeIcon icon={faPlus} className="me-2" />Nueva categoría</button>
      </div>

      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <input className="form-control" style={{ maxWidth: 300 }} placeholder="Buscar categoría o subcategoría" value={filtros.busqueda} onChange={(e) => setFiltros({ ...filtros, busqueda: e.target.value })} aria-label="Buscar categoría" />
        <div className="form-check form-switch ms-1">
          <input className="form-check-input" type="checkbox" id="soloActivas" checked={filtros.soloActivas} onChange={(e) => setFiltros({ ...filtros, soloActivas: e.target.checked })} />
          <label className="form-check-label small" htmlFor="soloActivas">Solo activas</label>
        </div>
        <select className="form-select" style={{ maxWidth: 200 }} value={filtros.prioridad} onChange={(e) => setFiltros({ ...filtros, prioridad: e.target.value })} aria-label="Prioridad">
          <option value="">Prioridad: todas</option>
          {LISTA_PRIORIDADES.map((p) => <option key={p.codigo} value={p.codigo}>{p.nombre}</option>)}
        </select>
        {filtrosActivos > 0 && <span className="small text-muted">Filtros activos: {filtrosActivos} · <button type="button" className="btn btn-link btn-sm p-0" onClick={() => setFiltros(FILTROS_INICIALES)}>Limpiar</button></span>}
      </div>

      <div className="card">
        {cargando ? (
          <div className="text-center py-5"><span className="spinner-border text-primary" /></div>
        ) : totalCategorias === 0 ? (
          <EmptyState icon={faTags} title="Aún no hay categorías de servicio" message="Crea la primera categoría para que la comunidad pueda registrar tickets. Puedes empezar con Audiovisuales y Redes." action={<Link to="/supervisor/categorias/nueva" className="btn btn-primary">Crear primera categoría</Link>} />
        ) : arbol.length === 0 ? (
          <EmptyState title="No hay categorías con estos filtros" action={<button type="button" className="btn btn-primary" onClick={() => setFiltros(FILTROS_INICIALES)}>Quitar filtros</button>} />
        ) : (
          <div className="table-responsive">
            <table className="table table-app">
              <thead>
                <tr><th>Categoría · Subcategoría</th><th>Prioridad</th><th>Tiempo esperado</th><th className="text-center">Tickets abiertos</th><th>Estado</th><th className="text-end">Acciones</th></tr>
              </thead>
              <tbody>
                {arbol.map((c) => [fila(c, false), ...c.subcategorias.map((s) => fila(s, true))])}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        show={!!confirmacion}
        title={confirmacion?.tipo === 'eliminar' ? `¿Eliminar "${confirmacion?.cat.nombre}"?` : `¿Desactivar "${confirmacion?.cat.nombre}"?`}
        confirmLabel={confirmacion?.tipo === 'eliminar' ? 'Eliminar' : 'Desactivar'}
        onConfirm={confirmar}
        onCancel={() => setConfirmacion(null)}
      >
        {confirmacion?.tipo === 'desactivar' && (
          <>
            <p className="text-muted">La categoría{confirmacion.cat.parentId === null ? ' y sus subcategorías' : ''} dejarán de aparecer al registrar tickets nuevos.</p>
            {confirmacion.enCurso > 0 && (
              <div className="alert alert-warning small mb-0">
                Tiene <strong>{confirmacion.enCurso} tickets en curso</strong>. Seguirán su atención normal, pero no se aceptarán tickets nuevos en esta categoría.
              </div>
            )}
          </>
        )}
        {confirmacion?.tipo === 'eliminar' && <p className="text-muted mb-0">Esta acción no se puede deshacer. Si la categoría ya tiene tickets, desactívala en lugar de eliminarla.</p>}
      </ConfirmDialog>
    </>
  );
}

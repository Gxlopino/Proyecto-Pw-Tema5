// HU-3 · 3.3 Mis tickets · Usuario (filtros por estado y fechas, búsqueda por código)
// src/pages/usuario/MisTickets.jsx
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTicket } from '@fortawesome/free-solid-svg-icons';
import { EstadoBadge, PrioridadBadge, LISTA_ESTADOS } from '../../widgets/Badges';
import EmptyState from '../../widgets/EmptyState';
import Paginacion, { paginar } from '../../widgets/Paginacion';
import { useAuth } from '../../context/AuthContext';
import { listarMisTickets, resumenUsuarioSync } from '../../services/tickets.service';
import { categoriasSync } from '../../services/catalogo.service';
import { formatFecha } from '../../helpers/datetime';

const FILTROS = { codigo: '', estado: '', desde: '', hasta: '', categoriaId: '' };

export default function MisTickets() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [filtros, setFiltros] = useState(FILTROS);
  const [lista, setLista] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [pagina, setPagina] = useState(1);
  const resumen = resumenUsuarioSync(usuario.id);
  const padres = categoriasSync().filter((c) => c.parentId === null);
  const info = paginar(lista, pagina, 8);
  const hayFiltros = JSON.stringify(filtros) !== JSON.stringify(FILTROS);
  const rangoInvalido = filtros.desde && filtros.hasta && filtros.desde > filtros.hasta;

  useEffect(() => {
    if (rangoInvalido) return;
    setCargando(true);
    listarMisTickets(usuario.id, filtros).then((l) => { setLista(l); setPagina(1); }).finally(() => setCargando(false));
  }, [usuario.id, filtros, rangoInvalido]);

  const cambiar = (e) => setFiltros({ ...filtros, [e.target.name]: e.target.value });

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
        <div>
          <h1 className="mb-1">Mis tickets</h1>
          <p className="text-muted mb-0">{resumen.total} tickets registrados · {resumen.abiertos} en curso</p>
        </div>
        <Link to="/usuario/tickets/nuevo" className="btn btn-primary"><FontAwesomeIcon icon={faPlus} className="me-2" />Registrar un ticket</Link>
      </div>

      <div className="d-flex flex-wrap align-items-end gap-2 mb-3">
        <input name="codigo" className="form-control font-mono" style={{ maxWidth: 200 }} placeholder="TCK-2026-…" value={filtros.codigo} onChange={cambiar} aria-label="Buscar por código" />
        <select name="estado" className="form-select" style={{ maxWidth: 190 }} value={filtros.estado} onChange={cambiar} aria-label="Estado">
          <option value="">Estado: todos</option>
          <option value="en_curso">En curso</option>
          {LISTA_ESTADOS.map((e) => <option key={e.codigo} value={e.codigo}>{e.nombre}</option>)}
        </select>
        <div className="d-flex align-items-center gap-1">
          <input type="date" name="desde" className={`form-control ${rangoInvalido ? 'is-invalid' : ''}`} value={filtros.desde} onChange={cambiar} aria-label="Desde" />
          <span className="text-muted">–</span>
          <input type="date" name="hasta" className={`form-control ${rangoInvalido ? 'is-invalid' : ''}`} value={filtros.hasta} onChange={cambiar} aria-label="Hasta" />
        </div>
        <select name="categoriaId" className="form-select" style={{ maxWidth: 210 }} value={filtros.categoriaId} onChange={cambiar} aria-label="Categoría">
          <option value="">Categoría: todas</option>
          {padres.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        {hayFiltros && <button type="button" className="btn btn-link btn-sm" onClick={() => setFiltros(FILTROS)}>Limpiar filtros</button>}
      </div>
      {rangoInvalido && <div className="text-danger small mb-2">La fecha inicial no puede ser posterior a la final.</div>}

      <div className="card">
        {cargando ? <div className="text-center py-5"><span className="spinner-border text-primary" /></div>
          : resumen.total === 0 ? (
            <EmptyState icon={faTicket} title="Todavía no has reportado nada" message="Cuando registres un ticket lo verás aquí con su estado y su prioridad." action={<Link to="/usuario/tickets/nuevo" className="btn btn-primary">Registrar un ticket</Link>} />
          ) : lista.length === 0 ? (
            <EmptyState title="No hay tickets con estos filtros" action={<button type="button" className="btn btn-primary" onClick={() => setFiltros(FILTROS)}>Quitar filtros</button>} />
          ) : (
            <>
              <div className="table-responsive">
                <table className="table table-app">
                  <thead><tr><th>Código</th><th>Asunto</th><th>Categoría</th><th>Ambiente</th><th>Registrado</th><th>Prioridad</th><th>Estado</th></tr></thead>
                  <tbody>
                    {info.items.map((t) => (
                      <tr key={t.id} role="button" onClick={() => navigate(`/usuario/tickets/${t.codigo}`)}>
                        <td><Link to={`/usuario/tickets/${t.codigo}`} className="ticket-code" onClick={(e) => e.stopPropagation()}>{t.codigo}</Link></td>
                        <td>{t.asunto}</td>
                        <td className="small text-muted">{t.categoria} · {t.subcategoria}</td>
                        <td className="font-mono small">{t.ambiente}</td>
                        <td className="small">{formatFecha(t.creadoEn)}</td>
                        <td><PrioridadBadge prioridad={t.prioridad} /></td>
                        <td><EstadoBadge estado={t.estado} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Paginacion info={info} onChange={setPagina} etiqueta="tickets" />
            </>
          )}
      </div>
    </>
  );
}

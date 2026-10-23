// HU-4 · 4.5 Bandeja del técnico · Técnico (con autoasignación sobre sus categorías)
// src/pages/tecnico/Bandeja.jsx
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { EstadoBadge, PrioridadBadge, nombreEstado } from '../../widgets/Badges';
import EmptyState from '../../widgets/EmptyState';
import TicketCard from '../../widgets/TicketCard';
import { useAuth } from '../../context/AuthContext';
import { bandejaTecnico, disponiblesParaTecnico, autoasignar } from '../../services/cola.service';
import { categoriasSync, categoriasDeTecnicoSync } from '../../services/catalogo.service';
import { nombreCompleto } from '../../services/auth.service';
import { plazoTexto, formatFecha, formatDuracion } from '../../helpers/datetime';

function textoPlazo(t) {
  if (t.estado === 'en_espera') return `Espera · retorno ${formatFecha(t.fechaRetorno)}`;
  if (t.estado === 'cerrado') return `Cerrado el ${formatFecha(t.cerradoEn)}`;
  if (t.estado === 'resuelto') return new Date(t.resueltoEn) <= new Date(t.venceEn) ? 'Atendido a tiempo' : 'Atendido fuera de plazo';
  return plazoTexto(t.venceEn);
}

export default function Bandeja() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const estado = params.get('estado') || '';
  const [filtro, setFiltro] = useState('todos');
  const [orden, setOrden] = useState('plazo');
  const [datos, setDatos] = useState(null);
  const [disponibles, setDisponibles] = useState([]);
  const categorias = categoriasSync();
  const misCategorias = categoriasDeTecnicoSync(usuario.id).map((id) => categorias.find((c) => c.id === id)?.nombre).filter(Boolean);

  const cargar = useCallback(() => {
    bandejaTecnico(usuario.id, { estado, filtro, orden }).then(setDatos);
    disponiblesParaTecnico(usuario.id).then(setDisponibles);
  }, [usuario.id, estado, filtro, orden]);

  useEffect(() => { cargar(); }, [cargar]);

  const tomar = async (t) => {
    try {
      await autoasignar(t.codigo, usuario);
      toast.success(`Tomaste ${t.codigo}. Ya está en tu bandeja.`);
      cargar();
    } catch (ex) {
      toast.error(ex.message);
      cargar();
    }
  };

  if (!datos) return <div className="text-center py-5"><span className="spinner-border text-primary" /></div>;
  const { lista, contadores } = datos;
  const vencidos = lista.filter((t) => t.vencido);

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
        <div>
          <h1 className="mb-1">Mi bandeja{estado ? ` · ${nombreEstado(estado)}` : ''}</h1>
          <p className="text-muted mb-0">{nombreCompleto(usuario)} · {misCategorias.join(' y ') || 'sin categorías habilitadas'} · {contadores.total} tickets asignados</p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          {[['abierto', 'Abiertos', contadores.abiertos, 'var(--color-info)'], ['en_atencion', 'En atención', contadores.en_atencion, 'var(--color-warning)'], ['en_espera', 'En espera', contadores.en_espera, 'var(--color-text-muted)'], ['resuelto', 'Resueltos', contadores.resuelto, 'var(--color-success)']].map(([e, label, n, color]) => (
            <button type="button" key={e} className="stat-pill" style={{ color, fontWeight: estado === e ? 700 : 400 }} onClick={() => setParams(estado === e ? {} : { estado: e })}>{label} {n}</button>
          ))}
        </div>
      </div>

      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <div className="btn-group btn-group-sm" role="group" aria-label="Filtro rápido">
          {[['todos', `Todos (${contadores.total})`], ['criticos', `Solo críticos (${contadores.criticos})`], ['vencidos', `Fuera de plazo (${contadores.vencidos})`], ['hoy', 'Hoy']].map(([k, label]) => (
            <button type="button" key={k} className={`btn ${filtro === k ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setFiltro(k)}>{label}</button>
          ))}
        </div>
        {estado && <button type="button" className="btn btn-link btn-sm" onClick={() => setParams({})}>Ver todos los estados</button>}
        <select className="form-select form-select-sm ms-auto" style={{ maxWidth: 230 }} value={orden} onChange={(e) => setOrden(e.target.value)} aria-label="Orden">
          <option value="plazo">Orden: prioridad y plazo</option>
          <option value="antiguedad">Orden: antigüedad</option>
        </select>
      </div>

      <div className="card mb-3">
        {lista.length === 0 ? (
          <EmptyState title="Sin tickets asignados" message={filtro !== 'todos' || estado ? 'No hay tickets con este filtro.' : 'Cuando el supervisor te asigne uno aparecerá aquí. También puedes tomar tickets disponibles de tus categorías.'} />
        ) : (
          <div className="table-responsive">
            <table className="table table-app">
              <thead><tr><th className="prio-bar" /><th>Código</th><th>Asunto</th><th>Categoría</th><th>Ambiente</th><th>Solicitante</th><th>Prioridad</th><th>Estado</th><th>Plazo</th><th className="text-end">Acción</th></tr></thead>
              <tbody>
                {lista.map((t) => (
                  <tr key={t.id} role="button" onClick={() => navigate(`/tecnico/tickets/${t.codigo}`)}>
                    <td className={`prio-bar prio-bar-${t.prioridad}`} />
                    <td><span className="ticket-code small">{t.codigo}</span></td>
                    <td>{t.asunto}</td>
                    <td className="small text-muted">{t.categoria}</td>
                    <td className="font-mono small">{t.ambiente}</td>
                    <td className="small">{t.solicitante}</td>
                    <td><PrioridadBadge prioridad={t.prioridad} /></td>
                    <td><EstadoBadge estado={t.estado} /></td>
                    <td className={`small ${t.vencido ? 'text-danger fw-semibold' : 'text-muted'}`}>{textoPlazo(t)}</td>
                    <td className="text-end"><Link to={`/tecnico/tickets/${t.codigo}`} className="btn btn-sm btn-tertiary text-nowrap" onClick={(e) => e.stopPropagation()}>Abrir bitácora</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {vencidos.length > 0 && (
        <div className="alert alert-danger small">
          {vencidos.length} ticket{vencidos.length > 1 ? 's' : ''} fuera del tiempo esperado: {vencidos.map((t) => `${t.codigo} (${formatDuracion(Date.now() - new Date(t.venceEn))} de retraso)`).join(', ')}. Atiéndelos o cámbialos a En espera con motivo.
        </div>
      )}

      <h2 className="mt-4 mb-2">Disponibles en mis categorías</h2>
      <p className="small text-muted">Tickets sin asignar de {misCategorias.join(', ') || 'tus categorías'}. Puedes tomarlos tú mismo.</p>
      {disponibles.length === 0 ? (
        <div className="card"><EmptyState title="No hay tickets disponibles" message="Todos los tickets de tus categorías ya tienen técnico." /></div>
      ) : (
        <div className="row g-3">
          {disponibles.map((t) => (
            <div className="col-md-6 col-xl-4" key={t.id}>
              <TicketCard ticket={t} action={<button type="button" className="btn btn-sm btn-primary" onClick={() => tomar(t)}>Tomar ticket</button>} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

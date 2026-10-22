// HU-5 · 5.5 Historial de cambios · Técnico (el supervisor la reutiliza)
// src/pages/tecnico/HistorialCambios.jsx
import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { EstadoBadge } from '../../widgets/Badges';
import { useAuth } from '../../context/AuthContext';
import { obtenerHistorial } from '../../services/atencion.service';
import { formatFecha, formatFechaHora, formatDuracion } from '../../helpers/datetime';
import NoEncontrado from '../../widgets/NoEncontrado';

export default function HistorialCambios() {
  const { codigo } = useParams();
  const { usuario } = useAuth();
  // Se usa en la app del técnico y en la del supervisor: los enlaces salen del prefijo del rol actual
  const base = `/${usuario.rol}`;
  const esSupervisor = usuario.rol === 'supervisor';
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => { obtenerHistorial(codigo, usuario).then(setDatos).catch((ex) => setError(ex.status || 404)); }, [codigo, usuario]);

  if (error === 403) return <NoEncontrado codigo={403} titulo="No tienes permiso para ver este ticket" mensaje="Este ticket no está asignado a ti. Si debes atenderlo, pide al supervisor que te lo asigne." />;
  if (error) return <NoEncontrado />;
  if (!datos) return <div className="text-center py-5"><span className="spinner-border text-primary" /></div>;

  const { ticket: t, eventos, etapas, tiempos } = datos;
  const pctEspera = tiempos.total ? Math.round((tiempos.espera / tiempos.total) * 100) : 0;
  const maxEtapa = Math.max(...etapas.map((e) => e.ms), 1);

  return (
    <>
      <nav className="small text-muted mb-1">
        <Link to={esSupervisor ? `${base}/cola` : `${base}/bandeja`}>{esSupervisor ? 'Cola de atención' : 'Mi bandeja'}</Link>
        {' · '}<Link to={`${base}/tickets/${t.codigo}`}>{t.codigo}</Link> · Historial de cambios
      </nav>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
        <h1 className="mb-0">Historial de cambios</h1>
        <EstadoBadge estado={t.estado} />
      </div>
      <p className="text-muted">
        {t.asunto} · {t.ambiente}
        {t.cerradoEn ? ` · cerrado el ${formatFecha(t.cerradoEn)}` : ''} · tiempo total {formatDuracion(tiempos.total)}
      </p>

      <div className="row g-3">
        <div className="col-lg-8">
          <div className="card p-4">
            <ul className="timeline">
              {eventos.map((e, i) => (
                <li key={i} className={e.tipo !== 'estado' ? 'evento' : ''}>
                  <div className="d-flex flex-wrap align-items-center gap-2">
                    {e.tipo === 'estado' ? <EstadoBadge estado={e.estado} /> : <span className="label-caps">{e.tipo === 'asignacion' ? 'Asignación' : 'Prioridad'}</span>}
                    <strong className="small">{e.tipo === 'estado' ? '' : e.titulo}</strong>
                  </div>
                  <div className="small text-muted mt-1">{formatFechaHora(e.creadoEn)} · {e.detalle}</div>
                  {e.permanencia && <div className="small mt-1">{e.permanencia}</div>}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="card p-3 mb-3">
            <h3 className="mb-3">Tiempo por etapa</h3>
            {etapas.map((e) => (
              <div key={e.estado} className="mb-2">
                <div className="d-flex justify-content-between small"><span>{e.nombre}</span><strong>{formatDuracion(e.ms)}</strong></div>
                <div className="progress" style={{ height: 6 }} role="progressbar" aria-label={e.nombre} aria-valuenow={Math.round((e.ms / maxEtapa) * 100)} aria-valuemin="0" aria-valuemax="100">
                  <div className={`progress-bar tag-${e.estado}`} style={{ width: `${(e.ms / maxEtapa) * 100}%`, backgroundColor: 'currentColor' }} />
                </div>
              </div>
            ))}
          </div>
          <div className="surface-soft small p-3">
            {tiempos.espera > 0
              ? `El ${pctEspera} % del tiempo se consumió en espera. El tiempo en espera no cuenta para el tiempo esperado de atención (${formatDuracion(tiempos.atencion)} efectivos).`
              : `Tiempo efectivo de atención: ${formatDuracion(tiempos.atencion)}. El ticket no pasó por espera.`}
          </div>
        </div>
      </div>
    </>
  );
}
   
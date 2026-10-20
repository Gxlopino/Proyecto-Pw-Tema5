// HU-3 · 3.2 Confirmación con código · Usuario
// src/pages/usuario/ConfirmacionTicket.jsx
import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';
import { EstadoBadge, PrioridadBadge } from '../../widgets/Badges';
import { useAuth } from '../../context/AuthContext';
import { obtenerTicket } from '../../services/tickets.service';
import { formatFecha, formatHora, formatDuracion } from '../../helpers/datetime';
import NoEncontrado from '../../widgets/NoEncontrado';

export default function ConfirmacionTicket() {
  const { codigo } = useParams();
  const { usuario } = useAuth();
  const [t, setT] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => { obtenerTicket(codigo, usuario).then(setT).catch(() => setError(true)); }, [codigo, usuario]);

  const copiar = () => {
    navigator.clipboard?.writeText(t.codigo);
    toast.info('Código copiado.');
  };

  if (error) return <NoEncontrado />;
  if (!t) return <div className="text-center py-5"><span className="spinner-border text-primary" /></div>;
  const horas = formatDuracion(new Date(t.venceEn) - new Date(t.creadoEn));

  return (
    <div className="card p-4 p-lg-5 mx-auto text-center" style={{ maxWidth: 760 }}>
      <span className="d-inline-flex align-items-center justify-content-center border border-success text-success rounded mx-auto mb-3" style={{ width: 48, height: 48, background: '#E7F4EC' }}>
        <FontAwesomeIcon icon={faCheck} size="lg" />
      </span>
      <h1 className="mb-1">Tu ticket quedó registrado</h1>
      <p className="text-muted">Guarda el código: con él puedes buscar el ticket desde la cabecera en cualquier momento.</p>
      <div className="d-flex justify-content-center align-items-center gap-3 my-3">
        <span className="big-code">{t.codigo}</span>
        <button type="button" className="btn btn-sm btn-outline-primary" onClick={copiar}>Copiar</button>
      </div>
      <div className="row g-3 text-start my-3">
        <div className="col-md-4"><div className="label-caps mb-1">Prioridad asignada</div><PrioridadBadge prioridad={t.prioridad} /> <EstadoBadge estado={t.estado} /></div>
        <div className="col-md-4"><div className="label-caps mb-1">Tiempo de atención esperado</div><div className="small">{horas} · antes de las {formatHora(t.venceEn)} del {formatFecha(t.venceEn)}</div></div>
        <div className="col-md-4"><div className="label-caps mb-1">Ambiente</div><div className="small">{t.ambiente} · {t.categoria}</div></div>
      </div>
      <div className="d-flex flex-wrap justify-content-center gap-2">
        <Link to={`/usuario/tickets/${t.codigo}`} className="btn btn-primary">Ver el detalle del ticket</Link>
        <Link to="/usuario/tickets" className="btn btn-outline-primary">Ir a mis tickets</Link>
      </div>
    </div>
  );
}

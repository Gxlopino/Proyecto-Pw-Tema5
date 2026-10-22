// src/widgets/TicketCard.jsx
// Tarjeta compacta de ticket (módulo común del grupo).
import React from 'react';
import { Link } from 'react-router-dom';
import { EstadoBadge, PrioridadBadge } from './Badges';
import { plazoTexto } from '../helpers/datetime';

export default function TicketCard({ ticket, to, action }) {
  return (
    <div className="card h-100" style={{ borderLeft: `4px solid var(--prio-${ticket.prioridad})` }}>
      <div className="card-body p-3">
        <div className="d-flex justify-content-between align-items-start gap-2 mb-1">
          {to ? <Link to={to} className="ticket-code small">{ticket.codigo}</Link> : <span className="ticket-code small">{ticket.codigo}</span>}
          <div className="d-flex gap-1"><PrioridadBadge prioridad={ticket.prioridad} /><EstadoBadge estado={ticket.estado} /></div>
        </div>
        <div className="fw-medium small mb-1">{ticket.asunto}</div>
        <div className="text-muted small">{ticket.categoria} · {ticket.ambiente}</div>
        <div className={`small mt-1 ${ticket.vencido ? 'text-danger fw-medium' : 'text-muted'}`}>
          {ticket.estado === 'en_espera' ? `En espera · ${ticket.motivoEspera || ''}` : plazoTexto(ticket.venceEn)}
        </div>
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}

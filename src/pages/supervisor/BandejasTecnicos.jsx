// HU-4 · Bandejas de técnicos (carga de cada técnico) · Supervisor
// src/pages/supervisor/BandejasTecnicos.jsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import EmptyState from '../../widgets/EmptyState';
import TicketCard from '../../widgets/TicketCard';
import { bandejasTecnicos } from '../../services/cola.service';

export default function BandejasTecnicos() {
  const [filas, setFilas] = useState(null);

  useEffect(() => { bandejasTecnicos().then(setFilas); }, []);

  if (!filas) return <div className="text-center py-5"><span className="spinner-border text-primary" /></div>;
  const total = filas.reduce((s, f) => s + f.tickets.length, 0);

  return (
    <>
      <h1 className="mb-1">Bandejas de técnicos</h1>
      <p className="text-muted">{filas.length} técnicos activos · {total} tickets en curso asignados</p>
      {filas.length === 0 && <div className="card"><EmptyState title="No hay técnicos activos" message="Invita técnicos desde «Técnicos por categoría»." /></div>}
      <div className="d-flex flex-column gap-3">
        {filas.map((f) => (
          <div className="card" key={f.id}>
            <div className="card-header d-flex flex-wrap align-items-center gap-2">
              <span>{f.nombre}</span>
              <span className="small text-muted fw-normal">{f.categorias.join(' · ') || 'Sin categorías'}</span>
              <div className="ms-auto d-flex flex-wrap gap-2 small fw-normal">
                <span className="tag tag-abierto">Abiertos {f.abiertos}</span>
                <span className="tag tag-en_atencion">En atención {f.en_atencion}</span>
                <span className="tag tag-en_espera">En espera {f.en_espera}</span>
                <span className="tag tag-resuelto">Resueltos {f.resueltos}</span>
                {f.vencidos > 0 && <span className="tag tag-critica">Fuera de plazo {f.vencidos}</span>}
              </div>
            </div>
            <div className="card-body">
              {f.tickets.length === 0 ? <p className="small text-muted mb-0">Sin tickets en curso. <Link to="/supervisor/cola">Asignar desde la cola</Link></p> : (
                <div className="row g-2">
                  {f.tickets.map((t) => <div className="col-md-6 col-xl-4" key={t.id}><TicketCard ticket={t} to={`/supervisor/tickets/${t.codigo}`} /></div>)}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

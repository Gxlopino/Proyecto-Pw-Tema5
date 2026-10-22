// src/widgets/Bitacora.jsx
// Lista de entradas de la bitácora. Las notas internas se resaltan y solo llegan si el rol puede verlas.
import React from 'react';
import { formatFechaHora } from '../helpers/datetime';
import { ROLES } from '../helpers/navigation';
import EmptyState from './EmptyState';

export default function Bitacora({ entradas = [] }) {
  if (!entradas.length) {
    return <EmptyState title="Sin entradas todavía" message="Los avances de la atención aparecerán aquí." />;
  }
  return (
    <div className="d-flex flex-column gap-2">
      {entradas.map((e) => (
        <div key={e.id} className={`bitacora-entry ${e.tipo === 'interno' ? 'interna' : ''}`}>
          <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
            <span className={`avatar avatar-sm rol-${e.autorRol}`}>{e.autorIniciales}</span>
            <strong className="small">{e.autor}</strong>
            <span className="text-muted small">{ROLES[e.autorRol] || ''} · {formatFechaHora(e.creadoEn)}</span>
            <span className={`ms-auto tag tag-${e.tipo}`}>
              {e.tipo === 'interno' ? 'Nota interna · no visible para el usuario' : 'Comentario público'}
            </span>
          </div>
          <p className="mb-0 small" style={{ whiteSpace: 'pre-line' }}>{e.texto}</p>
        </div>
      ))}
    </div>
  );
}

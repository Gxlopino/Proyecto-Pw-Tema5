// src/widgets/Paginacion.jsx
import React from 'react';

export function paginar(lista, pagina, porPagina) {
  const total = lista.length;
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const actual = Math.min(Math.max(1, pagina), paginas);
  const inicio = (actual - 1) * porPagina;
  return { items: lista.slice(inicio, inicio + porPagina), total, paginas, actual, desde: total ? inicio + 1 : 0, hasta: Math.min(inicio + porPagina, total) };
}

export default function Paginacion({ info, onChange, etiqueta = 'registros' }) {
  if (!info || info.total === 0) return null;
  return (
    <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 px-3 py-2 border-top small text-muted">
      <span>Mostrando {info.desde}–{info.hasta} de {info.total} {etiqueta}</span>
      {info.paginas > 1 && (
        <nav aria-label="Paginación">
          <ul className="pagination pagination-sm mb-0">
            <li className={`page-item ${info.actual === 1 ? 'disabled' : ''}`}>
              <button type="button" className="page-link" onClick={() => onChange(info.actual - 1)}>Anterior</button>
            </li>
            {Array.from({ length: info.paginas }, (_, i) => i + 1).map((n) => (
              <li key={n} className={`page-item ${n === info.actual ? 'active' : ''}`}>
                <button type="button" className="page-link" onClick={() => onChange(n)}>{n}</button>
              </li>
            ))}
            <li className={`page-item ${info.actual === info.paginas ? 'disabled' : ''}`}>
              <button type="button" className="page-link" onClick={() => onChange(info.actual + 1)}>Siguiente</button>
            </li>
          </ul>
        </nav>
      )}
    </div>
  );
}

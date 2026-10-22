// src/partials/CabeceraSupervisor.jsx
// Cabecera de la mini-app del supervisor: marca, buscador de tickets, contador, usuario y cerrar sesión.
import React from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars, faRightFromBracket } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../context/AuthContext';
import { nombreCompleto, iniciales } from '../services/auth.service';
import BuscadorTicket from '../widgets/BuscadorTicket';

export default function CabeceraSupervisor({ contadores = {}, onToggleMenu }) {
  const { usuario } = useAuth();

  return (
    <header className="app-header d-flex align-items-center gap-3 px-3">
      <button type="button" className="btn btn-sm text-white d-lg-none p-1" onClick={onToggleMenu} aria-label="Abrir menú">
        <FontAwesomeIcon icon={faBars} />
      </button>
      <Link to="/supervisor/cola" className="brand d-flex align-items-center gap-2">
        <span className="brand-mark" /> Mesa de Ayuda
      </Link>
      <BuscadorTicket />
      <div className="ms-auto d-flex align-items-center gap-3">
        <span className="header-chip d-none d-sm-inline">Cola sin asignar<strong>{contadores.sinAsignar ?? 0}</strong></span>
        <div className="text-end lh-sm d-none d-sm-block">
          <div className="small fw-medium">{nombreCompleto(usuario)}</div>
          <div className="text-white-50" style={{ fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase' }}>Supervisor</div>
        </div>
        <span className="avatar">{iniciales(usuario)}</span>
        <a href="/logout" className="btn btn-sm text-white p-1" title="Cerrar sesión" aria-label="Cerrar sesión">
          <FontAwesomeIcon icon={faRightFromBracket} />
        </a>
      </div>
    </header>
  );
}

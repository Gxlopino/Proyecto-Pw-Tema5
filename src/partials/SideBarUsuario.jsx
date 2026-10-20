// src/partials/SideBarUsuario.jsx
// Navegación lateral de la mini-app del usuario.
import React from 'react';
import { NavLink } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTicket, faUser, faRightFromBracket } from '@fortawesome/free-solid-svg-icons';

// "counter" es la clave del contador que calcula el layout
const MENU = [
  { to: '/usuario/tickets/nuevo', label: 'Nuevo ticket', icon: faPlus },
  { to: '/usuario/tickets', label: 'Mis tickets', icon: faTicket, counter: 'misTickets', end: true },
  { to: '/usuario/mi-cuenta', label: 'Mi cuenta', icon: faUser },
];

export default function SideBarUsuario({ contadores = {}, abierto = false, onNavigate }) {
  return (
    <aside className={`app-sidebar d-lg-flex flex-column ${abierto ? 'd-flex' : 'd-none'}`}>
      <div className="menu-title">Mis servicios</div>
      <nav className="nav flex-column">
        {MENU.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} onClick={onNavigate} className="nav-link">
            <FontAwesomeIcon icon={item.icon} fixedWidth className="text-muted" />
            <span>{item.label}</span>
            {item.counter && contadores[item.counter] !== undefined && <span className="count">{contadores[item.counter]}</span>}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto border-top py-2">
        <a href="/logout" className="nav-link">
          <FontAwesomeIcon icon={faRightFromBracket} fixedWidth className="text-muted" /> Cerrar sesión
        </a>
      </div>
    </aside>
  );
}

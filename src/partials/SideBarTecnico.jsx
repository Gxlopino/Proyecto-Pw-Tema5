// src/partials/SideBarTecnico.jsx
// Navegación lateral de la mini-app del técnico. Los filtros de la bandeja van como ?estado=.
import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faInbox, faScrewdriverWrench, faHourglassHalf, faCircleCheck, faUser, faRightFromBracket } from '@fortawesome/free-solid-svg-icons';

// "counter" es la clave del contador que calcula el layout
const MENU = [
  { to: '/tecnico/bandeja', label: 'Mi bandeja', icon: faInbox, counter: 'asignados', end: true },
  { to: '/tecnico/bandeja?estado=en_atencion', label: 'En atención', icon: faScrewdriverWrench, counter: 'en_atencion' },
  { to: '/tecnico/bandeja?estado=en_espera', label: 'En espera', icon: faHourglassHalf, counter: 'en_espera' },
  { to: '/tecnico/bandeja?estado=resuelto', label: 'Resueltos', icon: faCircleCheck, counter: 'resuelto' },
  { to: '/tecnico/mi-cuenta', label: 'Mi cuenta', icon: faUser },
];

export default function SideBarTecnico({ contadores = {}, abierto = false, onNavigate }) {
  const location = useLocation();

  // Los enlaces con ?estado= se marcan activos solo si coincide la búsqueda
  const esActivo = (to, isActive) => {
    const [path, query] = to.split('?');
    if (query) return location.pathname === path && location.search === `?${query}`;
    if (path === location.pathname && location.search && MENU.some((i) => i.to.startsWith(`${path}?`))) return false;
    return isActive;
  };

  return (
    <aside className={`app-sidebar d-lg-flex flex-column ${abierto ? 'd-flex' : 'd-none'}`}>
      <div className="menu-title">Atención</div>
      <nav className="nav flex-column">
        {MENU.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) => `nav-link ${esActivo(item.to, isActive) ? 'active' : ''}`}
          >
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

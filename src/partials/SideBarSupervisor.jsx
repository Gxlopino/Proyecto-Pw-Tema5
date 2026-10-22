// src/partials/SideBarSupervisor.jsx
// Navegación lateral de la mini-app del supervisor.
import React from 'react';
import { NavLink } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faListCheck, faUsersGear, faTags, faBuilding, faTableCells, faUser, faRightFromBracket } from '@fortawesome/free-solid-svg-icons';

// "counter" es la clave del contador que calcula el layout
const MENU = [
  { to: '/supervisor/cola', label: 'Cola de atención', icon: faListCheck, counter: 'cola' },
  { to: '/supervisor/bandejas', label: 'Bandejas de técnicos', icon: faUsersGear, counter: 'tecnicos' },
  { to: '/supervisor/categorias', label: 'Categorías', icon: faTags, counter: 'categorias' },
  { to: '/supervisor/ambientes', label: 'Sedes y ambientes', icon: faBuilding, counter: 'ambientes' },
  { to: '/supervisor/tecnicos-categoria', label: 'Técnicos por categoría', icon: faTableCells },
  { to: '/supervisor/mi-cuenta', label: 'Mi cuenta', icon: faUser },
];

export default function SideBarSupervisor({ contadores = {}, abierto = false, onNavigate }) {
  return (
    <aside className={`app-sidebar d-lg-flex flex-column ${abierto ? 'd-flex' : 'd-none'}`}>
      <div className="menu-title">Supervisión</div>
      <nav className="nav flex-column">
        {MENU.map((item) => (
          <NavLink key={item.to} to={item.to} onClick={onNavigate} className="nav-link">
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

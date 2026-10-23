// src/entries/usuario.jsx
// Mini-app del usuario (/usuario/*). Express la sirve solo con sesión de usuario (soloLogueado + soloUsuario).
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Outlet, Navigate, useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import 'react-toastify/dist/ReactToastify.css';
import './app.css';
import '../pages/usuario/usuario.css';

import { AuthProvider, useAuth } from '../context/AuthContext';
import { contadoresCabeceraSync } from '../services/cola.service';
import { DATA_EVENT } from '../services/api.client';
import CabeceraUsuario from '../partials/CabeceraUsuario';
import SideBarUsuario from '../partials/SideBarUsuario';
import FooterUsuario from '../partials/FooterUsuario';
import ScrollToTop from '../widgets/ScrollToTop';
import NoEncontrado from '../widgets/NoEncontrado';
import MiCuenta from '../widgets/MiCuenta';
// HU-3 · Tickets
import MisTickets from '../pages/usuario/MisTickets';
import NuevoTicket from '../pages/usuario/NuevoTicket';
import ConfirmacionTicket from '../pages/usuario/ConfirmacionTicket';
import DetalleTicket from '../pages/usuario/DetalleTicket';

/** Cabecera + navegación lateral + contenido + pie */
function UsuarioLayout() {
  const { usuario } = useAuth();
  const location = useLocation();
  const [contadores, setContadores] = useState(() => contadoresCabeceraSync(usuario));
  const [menuAbierto, setMenuAbierto] = useState(false);

  useEffect(() => {
    const actualizar = () => setContadores(contadoresCabeceraSync(usuario));
    actualizar();
    window.addEventListener(DATA_EVENT, actualizar);
    return () => window.removeEventListener(DATA_EVENT, actualizar);
  }, [usuario, location.pathname]);

  return (
    <div className="d-flex flex-column min-vh-100">
      <CabeceraUsuario contadores={contadores} onToggleMenu={() => setMenuAbierto((v) => !v)} />
      <div className="app-body d-flex flex-column flex-lg-row flex-grow-1">
        <SideBarUsuario contadores={contadores} abierto={menuAbierto} onNavigate={() => setMenuAbierto(false)} />
        <div className="app-main flex-grow-1 d-flex flex-column">
          <main className="flex-grow-1">
            <div className="app-content">
              <Outlet />
            </div>
          </main>
          <FooterUsuario />
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider rol="usuario">
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          <Route element={<UsuarioLayout />}>
            <Route path="/usuario" element={<Navigate to="/usuario/tickets" replace />} />
            <Route path="/usuario/tickets" element={<MisTickets />} />
            <Route path="/usuario/tickets/nuevo" element={<NuevoTicket />} />
            <Route path="/usuario/tickets/:codigo" element={<DetalleTicket />} />
            <Route path="/usuario/tickets/:codigo/confirmacion" element={<ConfirmacionTicket />} />
            <Route path="/usuario/mi-cuenta" element={<MiCuenta />} />
            <Route path="*" element={<NoEncontrado />} />
          </Route>
        </Routes>
        <ToastContainer position="top-right" autoClose={3500} newestOnTop theme="light" />
      </BrowserRouter>
    </AuthProvider>
  );
}

const container = document.getElementById('root');
if (container) {
  ReactDOM.createRoot(container).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

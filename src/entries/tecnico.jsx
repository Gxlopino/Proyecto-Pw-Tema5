// src/entries/tecnico.jsx
// Mini-app del técnico (/tecnico/*). Express la sirve solo con sesión de técnico (soloLogueado + soloTecnico).
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Outlet, Navigate, useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import 'react-toastify/dist/ReactToastify.css';
import './app.css';
import '../pages/tecnico/tecnico.css';

import { AuthProvider, useAuth } from '../context/AuthContext';
import { contadoresCabeceraSync } from '../services/cola.service';
import { DATA_EVENT } from '../services/api.client';
import CabeceraTecnico from '../partials/CabeceraTecnico';
import SideBarTecnico from '../partials/SideBarTecnico';
import FooterTecnico from '../partials/FooterTecnico';
import ScrollToTop from '../widgets/ScrollToTop';
import NoEncontrado from '../widgets/NoEncontrado';
import MiCuenta from '../widgets/MiCuenta';
// HU-4 · Bandeja
import Bandeja from '../pages/tecnico/Bandeja';
// HU-5 · Atención y cierre
import DetalleTicket from '../pages/tecnico/DetalleTicket';
import HistorialCambios from '../pages/tecnico/HistorialCambios';

/** Cabecera + navegación lateral + contenido + pie */
function TecnicoLayout() {
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
      <CabeceraTecnico contadores={contadores} onToggleMenu={() => setMenuAbierto((v) => !v)} />
      <div className="app-body d-flex flex-column flex-lg-row flex-grow-1">
        <SideBarTecnico contadores={contadores} abierto={menuAbierto} onNavigate={() => setMenuAbierto(false)} />
        <div className="app-main flex-grow-1 d-flex flex-column">
          <main className="flex-grow-1">
            <div className="app-content">
              <Outlet />
            </div>
          </main>
          <FooterTecnico />
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider rol="tecnico">
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          <Route element={<TecnicoLayout />}>
            <Route path="/tecnico" element={<Navigate to="/tecnico/bandeja" replace />} />
            <Route path="/tecnico/bandeja" element={<Bandeja />} />
            <Route path="/tecnico/tickets/:codigo" element={<DetalleTicket />} />
            <Route path="/tecnico/tickets/:codigo/historial" element={<HistorialCambios />} />
            <Route path="/tecnico/mi-cuenta" element={<MiCuenta />} />
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

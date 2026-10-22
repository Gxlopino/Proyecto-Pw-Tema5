// src/entries/supervisor.jsx
// Mini-app del supervisor (/supervisor/*). Express la sirve solo con sesión de supervisor (soloLogueado + soloSupervisor).
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Outlet, Navigate, useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import 'react-toastify/dist/ReactToastify.css';
import './app.css';
import '../pages/supervisor/supervisor.css';

import { AuthProvider, useAuth } from '../context/AuthContext';
import { contadoresCabeceraSync } from '../services/cola.service';
import { DATA_EVENT } from '../services/api.client';
import CabeceraSupervisor from '../partials/CabeceraSupervisor';
import SideBarSupervisor from '../partials/SideBarSupervisor';
import FooterSupervisor from '../partials/FooterSupervisor';
import ScrollToTop from '../widgets/ScrollToTop';
import NoEncontrado from '../widgets/NoEncontrado';
import MiCuenta from '../widgets/MiCuenta';
// HU-2 · Catálogo
import Categorias from '../pages/supervisor/Categorias';
import CategoriaForm from '../pages/supervisor/CategoriaForm';
import Ambientes from '../pages/supervisor/Ambientes';
import TecnicosPorCategoria from '../pages/supervisor/TecnicosPorCategoria';
// HU-4 · Cola y asignación
import Cola from '../pages/supervisor/Cola';
import BandejasTecnicos from '../pages/supervisor/BandejasTecnicos';
// HU-5 · Atención y cierre (las mismas páginas del técnico, no se duplican)
import DetalleTicket from '../pages/tecnico/DetalleTicket';
import HistorialCambios from '../pages/tecnico/HistorialCambios';

/** Cabecera + navegación lateral + contenido + pie */
function SupervisorLayout() {
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
      <CabeceraSupervisor contadores={contadores} onToggleMenu={() => setMenuAbierto((v) => !v)} />
      <div className="app-body d-flex flex-column flex-lg-row flex-grow-1">
        <SideBarSupervisor contadores={contadores} abierto={menuAbierto} onNavigate={() => setMenuAbierto(false)} />
        <div className="app-main flex-grow-1 d-flex flex-column">
          <main className="flex-grow-1">
            <div className="app-content">
              <Outlet />
            </div>
          </main>
          <FooterSupervisor />
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider rol="supervisor">
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          <Route element={<SupervisorLayout />}>
            <Route path="/supervisor" element={<Navigate to="/supervisor/cola" replace />} />
            <Route path="/supervisor/cola" element={<Cola />} />
            <Route path="/supervisor/bandejas" element={<BandejasTecnicos />} />
            <Route path="/supervisor/categorias" element={<Categorias />} />
            <Route path="/supervisor/categorias/nueva" element={<CategoriaForm />} />
            <Route path="/supervisor/categorias/:id" element={<CategoriaForm />} />
            <Route path="/supervisor/ambientes" element={<Ambientes />} />
            <Route path="/supervisor/tecnicos-categoria" element={<TecnicosPorCategoria />} />
            <Route path="/supervisor/tickets/:codigo" element={<DetalleTicket />} />
            <Route path="/supervisor/tickets/:codigo/historial" element={<HistorialCambios />} />
            <Route path="/supervisor/mi-cuenta" element={<MiCuenta />} />
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

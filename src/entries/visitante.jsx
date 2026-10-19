// src/entries/visitante.jsx
// Mini-app del visitante (sin sesión): /registro, /recuperar y /invitacion/:token.
// La cabecera y el pie los pone views/layouts/website.ejs; el login y la landing son EJS.
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import 'react-toastify/dist/ReactToastify.css';
import './app.css';
import '../pages/visitante/visitante.css';

import ScrollToTop from '../widgets/ScrollToTop';
import NoEncontrado from '../widgets/NoEncontrado';
// HU-1 · Cuenta y acceso
import Registro from '../pages/visitante/Registro';
import RecuperarPassword from '../pages/visitante/RecuperarPassword';
import AltaInvitacion from '../pages/visitante/AltaInvitacion';

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/registro" element={<Registro />} />
        <Route path="/recuperar" element={<RecuperarPassword />} />
        <Route path="/invitacion/:token" element={<AltaInvitacion />} />
        <Route path="*" element={<NoEncontrado />} />
      </Routes>
      <ToastContainer position="top-right" autoClose={3500} newestOnTop theme="light" />
    </BrowserRouter>
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

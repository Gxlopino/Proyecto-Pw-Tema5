// src/widgets/ScrollToTop.jsx
// Vuelve al inicio de la página en cada cambio de ruta (lo usan todas las mini-apps).
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

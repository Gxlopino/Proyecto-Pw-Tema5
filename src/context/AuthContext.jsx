// src/context/AuthContext.jsx
// Sesión global de cada mini-app con sesión (usuario, técnico, supervisor). Las páginas leen el usuario con useAuth().
// El login es del servidor: aquí solo se pregunta quién está logueado (GET /api/v1/sessions) y no se pinta la app
// hasta tener la respuesta. Sin sesión, o con otro rol, se vuelve al servidor para que decida a dónde ir.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as authService from '../services/auth.service';
import { rutaInicio } from '../helpers/navigation';

const AuthContext = createContext(null);

export function AuthProvider({ rol, children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  /** Vuelve a leer la sesión (por ejemplo, tras editar "Mi cuenta") */
  const refrescar = useCallback(async () => {
    const u = await authService.obtenerSesion();
    setUsuario(u);
    return u;
  }, []);

  useEffect(() => {
    refrescar()
      .then((u) => {
        if (u.rol !== rol) window.location.replace(rutaInicio(u.rol));
        else setCargando(false);
      })
      .catch(() => window.location.replace('/login'));
  }, [refrescar, rol]);

  const value = useMemo(() => ({ usuario, refrescar }), [usuario, refrescar]);

  if (cargando) {
    return <div className="min-vh-100 d-flex align-items-center justify-content-center"><span className="spinner-border text-primary" role="status" aria-label="Cargando" /></div>;
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}

/** Para los componentes que también se muestran en la mini-app pública (sin sesión) */
export function useSesionOpcional() {
  return useContext(AuthContext);
}

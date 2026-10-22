// 404 dentro de cada mini-app (rutas desconocidas de su prefijo, ticket inexistente o ajeno)
// src/widgets/NoEncontrado.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { useSesionOpcional } from '../context/AuthContext';
import { rutaInicio } from '../helpers/navigation';

export default function NoEncontrado({
  codigo = 404,
  titulo = 'No encontramos esta página',
  mensaje = 'El enlace puede haber cambiado. Si buscabas un ticket, ingresa su código en el buscador de la cabecera.',
}) {
  const sesion = useSesionOpcional();
  const usuario = sesion?.usuario;
  return (
    <div className={usuario ? 'py-4' : 'container-xl py-5'}>
      <div className="card p-4 p-lg-5" style={{ maxWidth: 720 }}>
        <div className="big-number mb-2">{codigo}</div>
        <h1 className="mb-2">{titulo}</h1>
        <p className="text-muted">{mensaje}</p>
        <div className="d-flex flex-wrap gap-2">
          {usuario ? (
            <>
              <Link to={rutaInicio(usuario.rol)} className="btn btn-primary">Ir al inicio</Link>
              <Link to={rutaInicio(usuario.rol)} className="btn btn-outline-primary">Buscar un ticket</Link>
            </>
          ) : (
            <>
              <a href="/" className="btn btn-primary">Ir al inicio</a>
              <a href="/login" className="btn btn-outline-primary">Iniciar sesión</a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

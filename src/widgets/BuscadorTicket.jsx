// src/widgets/BuscadorTicket.jsx
// Buscador por código de ticket de la cabecera. Navega dentro del rol actual (/<rol>/tickets/:codigo).
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import { obtenerTicket } from '../services/tickets.service';

export default function BuscadorTicket() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [codigo, setCodigo] = useState('');

  const buscar = async (e) => {
    e.preventDefault();
    const texto = codigo.trim().toUpperCase();
    if (!texto) return;
    const completo = /^\d+$/.test(texto) ? `TCK-${new Date().getFullYear()}-${texto.padStart(5, '0')}` : texto;
    try {
      const t = await obtenerTicket(completo, usuario);
      if (usuario.rol === 'tecnico' && t.tecnicoId !== usuario.id) {
        toast.warning(`${t.codigo} no está asignado a ti.`);
        return;
      }
      setCodigo('');
      navigate(`/${usuario.rol}/tickets/${t.codigo}`);
    } catch (err) {
      toast.error(err.status === 403 ? 'Ese ticket no es tuyo.' : `No encontramos el ticket ${completo}.`);
    }
  };

  return (
    <form className="flex-grow-1 d-none d-md-block" onSubmit={buscar} role="search">
      <div className="position-relative" style={{ maxWidth: 360 }}>
        <FontAwesomeIcon icon={faMagnifyingGlass} className="position-absolute text-white-50" style={{ left: 10, top: 10, fontSize: 13 }} />
        <input
          className="form-control form-control-sm header-search ps-4"
          placeholder="Buscar por código de ticket · TCK-2026-…"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          aria-label="Buscar por código de ticket"
        />
      </div>
    </form>
  );
}

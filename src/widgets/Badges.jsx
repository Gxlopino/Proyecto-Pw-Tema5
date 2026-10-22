// src/widgets/Badges.jsx
// Etiquetas de estado y prioridad (módulo común del grupo).
import React from 'react';

const ESTADOS = {
  abierto: 'Abierto',
  en_atencion: 'En atención',
  en_espera: 'En espera',
  resuelto: 'Resuelto',
  cerrado: 'Cerrado',
  reabierto: 'Reabierto',
  cancelado: 'Cancelado',
};

const PRIORIDADES = { critica: 'Crítica', alta: 'Alta', media: 'Media', baja: 'Baja' };

export const nombreEstado = (codigo) => ESTADOS[codigo] || codigo;
export const nombrePrioridad = (codigo) => PRIORIDADES[codigo] || codigo;
export const LISTA_ESTADOS = Object.entries(ESTADOS).map(([codigo, nombre]) => ({ codigo, nombre }));
export const LISTA_PRIORIDADES = Object.entries(PRIORIDADES).map(([codigo, nombre]) => ({ codigo, nombre }));

export function EstadoBadge({ estado }) {
  return <span className={`tag tag-${estado}`}>{nombreEstado(estado)}</span>;
}

export function PrioridadBadge({ prioridad }) {
  return <span className={`tag tag-${prioridad}`}>{nombrePrioridad(prioridad)}</span>;
}

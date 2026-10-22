// src/widgets/EmptyState.jsx
// Estado vacío para toda vista que pueda quedar sin datos.
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faInbox } from '@fortawesome/free-solid-svg-icons';

export default function EmptyState({ title, message, action, icon = faInbox }) {
  return (
    <div className="empty-state">
      <div className="empty-icon mb-3"><FontAwesomeIcon icon={icon} /></div>
      <h3 className="mb-1">{title}</h3>
      {message && <p className="text-muted mb-3 mx-auto" style={{ maxWidth: 380 }}>{message}</p>}
      {action}
    </div>
  );
}

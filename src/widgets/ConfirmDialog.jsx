// src/widgets/ConfirmDialog.jsx
// Confirmación explícita para toda acción destructiva.
import React, { useState } from 'react';
import Modal from './Modal';

export default function ConfirmDialog({
  show,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'danger',
  onConfirm,
  onCancel,
  children,
}) {
  const [enviando, setEnviando] = useState(false);

  const confirmar = async () => {
    setEnviando(true);
    try { await onConfirm?.(); } finally { setEnviando(false); }
  };

  return (
    <Modal
      show={show}
      title={title}
      onClose={enviando ? undefined : onCancel}
      footer={(
        <>
          <button type="button" className="btn btn-outline-primary" onClick={onCancel} disabled={enviando}>{cancelLabel}</button>
          <button type="button" className={`btn btn-${variant}`} onClick={confirmar} disabled={enviando}>
            {enviando && <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />}
            {confirmLabel}
          </button>
        </>
      )}
    >
      {message && <p className="text-muted mb-2">{message}</p>}
      {children}
    </Modal>
  );
}

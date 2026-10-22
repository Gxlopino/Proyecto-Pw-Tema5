// src/widgets/Modal.jsx
// Modal controlado con las clases de Bootstrap 5 (se abre/cierra con la prop "show").
import React, { useEffect } from 'react';

export default function Modal({ show, title, subtitle, onClose, children, footer, size = '' }) {
  useEffect(() => {
    if (!show) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('overflow-hidden');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('overflow-hidden');
    };
  }, [show, onClose]);

  if (!show) return null;
  return (
    <>
      <div className="modal-backdrop-app" onClick={onClose} />
      <div className="modal modal-app d-block" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
        <div className={`modal-dialog modal-dialog-centered modal-dialog-scrollable ${size}`} onClick={(e) => e.stopPropagation()}>
          <div className="modal-content">
            <div className="modal-header border-0 pb-0 align-items-start">
              <div>
                <h2 className="modal-title mb-1">{title}</h2>
                {subtitle && <div className="text-muted small">{subtitle}</div>}
              </div>
              <button type="button" className="btn-close" aria-label="Cerrar" onClick={onClose} />
            </div>
            <div className="modal-body">{children}</div>
            {footer && <div className="modal-footer border-0 pt-0">{footer}</div>}
          </div>
        </div>
      </div>
    </>
  );
}

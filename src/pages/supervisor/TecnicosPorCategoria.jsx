// HU-2 · 2.4 Técnicos por categoría · Supervisor (matriz de asignación + invitar técnico)
// src/pages/supervisor/TecnicosPorCategoria.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserPlus, faFloppyDisk } from '@fortawesome/free-solid-svg-icons';
import Modal from '../../widgets/Modal';
import EmptyState from '../../widgets/EmptyState';
import FormField, { inputClass } from '../../widgets/FormField';
import { obtenerMatrizTecnicos, guardarMatrizTecnicos, listarCategorias } from '../../services/catalogo.service';
import { crearInvitacion } from '../../services/auth.service';

const INVITACION = { nombres: '', apellidos: '', email: '', rol: 'tecnico', telefono: '' };

export default function TecnicosPorCategoria() {
  const [datos, setDatos] = useState(null);
  const [matriz, setMatriz] = useState({});
  const [original, setOriginal] = useState('{}');
  const [abiertosPorCat, setAbiertosPorCat] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [invitar, setInvitar] = useState(null);
  const [erroresInv, setErroresInv] = useState({});
  const [enlace, setEnlace] = useState(null);

  const cargar = async () => {
    const d = await obtenerMatrizTecnicos();
    const m = Object.fromEntries(d.filas.map((f) => [f.id, f.categorias]));
    setDatos(d);
    setMatriz(m);
    setOriginal(JSON.stringify(m));
    const arbol = await listarCategorias();
    setAbiertosPorCat(Object.fromEntries(arbol.map((c) => [c.id, c.ticketsAbiertos])));
  };

  useEffect(() => { cargar(); }, []);

  const toggle = (tecnicoId, categoriaId) => {
    setMatriz((m) => {
      const actual = m[tecnicoId] || [];
      return { ...m, [tecnicoId]: actual.includes(categoriaId) ? actual.filter((c) => c !== categoriaId) : [...actual, categoriaId] };
    });
  };

  const sucio = JSON.stringify(matriz) !== original;

  const alertas = useMemo(() => {
    if (!datos) return [];
    return datos.categorias
      .filter((c) => c.activa)
      .map((c) => ({ c, habilitados: Object.values(matriz).filter((cats) => cats.includes(c.id)).length, abiertos: abiertosPorCat[c.id] || 0 }))
      .filter((x) => x.habilitados === 0 || (x.habilitados <= 2 && x.abiertos >= x.habilitados * 2));
  }, [datos, matriz, abiertosPorCat]);

  const guardar = async () => {
    setGuardando(true);
    try {
      await guardarMatrizTecnicos(matriz);
      setOriginal(JSON.stringify(matriz));
      toast.success('Matriz de técnicos guardada.');
    } catch (ex) {
      toast.error(ex.message);
    } finally {
      setGuardando(false);
    }
  };

  const enviarInvitacion = async () => {
    try {
      const inv = await crearInvitacion(invitar);
      setInvitar(null);
      setEnlace(`${window.location.origin}/invitacion/${inv.token}`);
      toast.success(`Invitación creada para ${inv.nombres} ${inv.apellidos}.`);
    } catch (ex) {
      if (ex.errores) setErroresInv(ex.errores);
      toast.error(ex.message);
    }
  };

  if (!datos) return <div className="text-center py-5"><span className="spinner-border text-primary" /></div>;

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
        <div>
          <h1 className="mb-1">Técnicos por categoría</h1>
          <p className="text-muted mb-0">Marca las categorías que cada técnico puede atender. La cola solo ofrece técnicos habilitados al asignar.</p>
        </div>
        <div className="d-flex gap-2">
          <button type="button" className="btn btn-outline-primary" onClick={() => { setErroresInv({}); setInvitar({ ...INVITACION }); }}><FontAwesomeIcon icon={faUserPlus} className="me-2" />Invitar técnico</button>
          <button type="button" className="btn btn-primary" onClick={guardar} disabled={!sucio || guardando}>{guardando ? <span className="spinner-border spinner-border-sm me-2" /> : <FontAwesomeIcon icon={faFloppyDisk} className="me-2" />}Guardar matriz</button>
        </div>
      </div>

      {enlace && (
        <div className="alert alert-info small d-flex flex-wrap align-items-center gap-2">
          <span>Sin envío real de correos (Entrega 1). Comparte este enlace con la persona invitada:</span>
          <code className="ticket">{enlace}</code>
          <button type="button" className="btn btn-sm btn-outline-primary ms-auto" onClick={() => { navigator.clipboard?.writeText(enlace); toast.info('Enlace copiado.'); }}>Copiar</button>
        </div>
      )}

      <div className="card mb-3">
        {datos.filas.length === 0 ? (
          <EmptyState title="Aún no hay técnicos activos" message="Invita al primer técnico para poder asignar tickets." />
        ) : (
          <div className="table-responsive">
            <table className="table table-app matrix">
              <thead>
                <tr>
                  <th>Técnico</th><th>Especialidad declarada</th><th>Carga actual</th>
                  {datos.categorias.map((c) => <th key={c.id} className={!c.activa ? 'text-decoration-line-through' : ''}>{c.nombre}</th>)}
                </tr>
              </thead>
              <tbody>
                {datos.filas.map((f) => (
                  <tr key={f.id}>
                    <td className="fw-medium text-nowrap">{f.nombre}</td>
                    <td className="small text-muted">{f.especialidadDeclarada.join(', ') || '—'}</td>
                    <td className="text-nowrap">{f.carga} tickets</td>
                    {datos.categorias.map((c) => (
                      <td key={c.id}>
                        <input
                          type="checkbox"
                          className="form-check-input"
                          aria-label={`${f.nombre} atiende ${c.nombre}`}
                          checked={(matriz[f.id] || []).includes(c.id)}
                          onChange={() => toggle(f.id, c.id)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="row g-3">
        <div className="col-md-8">
          {alertas.map(({ c, habilitados, abiertos }) => (
            <div key={c.id} className="alert alert-warning small mb-2">
              {habilitados === 0
                ? `${c.nombre} no tiene técnicos habilitados: sus tickets no podrán asignarse.`
                : `${c.nombre} tiene solo ${habilitados} técnico${habilitados > 1 ? 's' : ''} habilitado${habilitados > 1 ? 's' : ''} y ${abiertos} tickets abiertos. Considera habilitar otro.`}
            </div>
          ))}
        </div>
        <div className="col-md-4 small text-muted">Carga actual = tickets asignados en estado abierto, en atención o en espera.</div>
      </div>

      <Modal
        show={!!invitar}
        title="Invitar técnico o supervisor"
        subtitle="La persona recibe un enlace para activar su cuenta y definir su contraseña."
        onClose={() => setInvitar(null)}
        footer={(
          <>
            <button type="button" className="btn btn-outline-primary" onClick={() => setInvitar(null)}>Cancelar</button>
            <button type="button" className="btn btn-primary" onClick={enviarInvitacion}>Crear invitación</button>
          </>
        )}
      >
        {invitar && (
          <div className="row g-3">
            <div className="col-6"><FormField id="invNombres" label="Nombres" error={erroresInv.nombres} className=""><input id="invNombres" className={inputClass(erroresInv.nombres)} value={invitar.nombres} onChange={(e) => setInvitar({ ...invitar, nombres: e.target.value })} /></FormField></div>
            <div className="col-6"><FormField id="invApellidos" label="Apellidos" error={erroresInv.apellidos} className=""><input id="invApellidos" className={inputClass(erroresInv.apellidos)} value={invitar.apellidos} onChange={(e) => setInvitar({ ...invitar, apellidos: e.target.value })} /></FormField></div>
            <div className="col-12"><FormField id="invEmail" label="Correo institucional" error={erroresInv.email} className=""><input id="invEmail" type="email" className={inputClass(erroresInv.email)} value={invitar.email} onChange={(e) => setInvitar({ ...invitar, email: e.target.value })} placeholder="nombre@ulima.edu.pe" /></FormField></div>
            <div className="col-6"><FormField id="invRol" label="Rol" error={erroresInv.rol} className=""><select id="invRol" className="form-select" value={invitar.rol} onChange={(e) => setInvitar({ ...invitar, rol: e.target.value })}><option value="tecnico">Técnico</option><option value="supervisor">Supervisor</option></select></FormField></div>
            <div className="col-6"><FormField id="invTel" label="Teléfono (opcional)" className=""><input id="invTel" className="form-control" value={invitar.telefono} onChange={(e) => setInvitar({ ...invitar, telefono: e.target.value })} /></FormField></div>
          </div>
        )}
      </Modal>
    </>
  );
}

// HU-3 · 3.4 Detalle del ticket · 3.5 modal de reapertura · cancelación · Usuario
// src/pages/usuario/DetalleTicket.jsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { EstadoBadge, PrioridadBadge } from '../../widgets/Badges';
import Bitacora from '../../widgets/Bitacora';
import Modal from '../../widgets/Modal';
import ConfirmDialog from '../../widgets/ConfirmDialog';
import FormField, { inputClass } from '../../widgets/FormField';
import { useAuth } from '../../context/AuthContext';
import { obtenerTicket, agregarInformacion, cancelarTicket, reabrirTicket, puedeCancelar, puedeReabrir, PLAZO_REAPERTURA_DIAS, MAX_DESCRIPCION } from '../../services/tickets.service';
import { listarBitacora, obtenerHistorial } from '../../services/atencion.service';
import { formatFecha, formatFechaHora, formatHora } from '../../helpers/datetime';
import NoEncontrado from '../../widgets/NoEncontrado';

const PASOS = ['abierto', 'en_atencion', 'resuelto', 'cerrado'];
const NOMBRE_PASO = { abierto: 'Abierto', asignado: 'Asignado', en_atencion: 'En atención', resuelto: 'Resuelto', cerrado: 'Cerrado' };

export default function DetalleTicket() {
  const { codigo } = useParams();
  const { usuario } = useAuth();
  const [t, setT] = useState(null);
  const [error, setError] = useState(null);
  const [bitacora, setBitacora] = useState([]);
  const [historial, setHistorial] = useState(null);
  const [texto, setTexto] = useState('');
  const [errorTexto, setErrorTexto] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [modalReabrir, setModalReabrir] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [errorMotivo, setErrorMotivo] = useState(null);
  const [confirmarCancelar, setConfirmarCancelar] = useState(false);
  const [motivoCancelar, setMotivoCancelar] = useState('');
  const composerRef = useRef(null);

  const cargar = useCallback(async () => {
    try {
      const ticket = await obtenerTicket(codigo, usuario);
      setT(ticket);
      setBitacora(await listarBitacora(ticket.id, { incluirInternas: false }));
      setHistorial(await obtenerHistorial(codigo, usuario));
    } catch (ex) {
      setError(ex.status || 404);
    }
  }, [codigo, usuario]);

  useEffect(() => { cargar(); }, [cargar]);

  const enviarComentario = async (e) => {
    e.preventDefault();
    setErrorTexto(null);
    setEnviando(true);
    try {
      await agregarInformacion(codigo, usuario, texto);
      setTexto('');
      toast.success('Tu comentario se agregó a la bitácora.');
      cargar();
    } catch (ex) {
      setErrorTexto(ex.errores?.texto || ex.message);
    } finally {
      setEnviando(false);
    }
  };

  const reabrir = async () => {
    setErrorMotivo(null);
    try {
      await reabrirTicket(codigo, usuario, motivo);
      toast.success(`Ticket ${codigo} reabierto. El técnico volverá a revisarlo.`);
      setModalReabrir(false);
      setMotivo('');
      cargar();
    } catch (ex) {
      if (ex.errores) setErrorMotivo(ex.errores.motivo);
      else { toast.error(ex.message); setModalReabrir(false); }
    }
  };

  const cancelar = async () => {
    try {
      await cancelarTicket(codigo, usuario, motivoCancelar);
      toast.success(`Ticket ${codigo} cancelado.`);
      setConfirmarCancelar(false);
      cargar();
    } catch (ex) {
      toast.error(ex.message);
      setConfirmarCancelar(false);
    }
  };

  if (error === 403) return <NoEncontrado codigo={403} titulo="No tienes permiso para ver este ticket" mensaje="Solo puedes ver los tickets que registraste. Si buscabas otro, revisa el código." />;
  if (error) return <NoEncontrado />;
  if (!t || !historial) return <div className="text-center py-5"><span className="spinner-border text-primary" /></div>;

  const admiteComentarios = !['cerrado', 'cancelado'].includes(t.estado);
  const eventosLinea = historial.eventos.filter((e) => e.tipo === 'estado' || (e.tipo === 'asignacion' && !e.titulo.startsWith('Devuelto')));
  const alcanzados = new Set(historial.eventos.filter((e) => e.tipo === 'estado').map((e) => e.estado));
  const pendientes = t.estado === 'cancelado' ? [] : PASOS.filter((p) => !alcanzados.has(p));
  const reabrible = puedeReabrir(t);

  return (
    <>
      <nav className="small text-muted mb-1"><Link to="/usuario/tickets">Mis tickets</Link> · {t.codigo}</nav>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
        <span className="big-code" style={{ fontSize: 24 }}>{t.codigo}</span>
        <PrioridadBadge prioridad={t.prioridad} />
        <EstadoBadge estado={t.estado} />
        <div className="ms-auto d-flex gap-2">
          {puedeCancelar(t) && <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => setConfirmarCancelar(true)}>Cancelar ticket</button>}
          {admiteComentarios && <button type="button" className="btn btn-primary btn-sm" onClick={() => composerRef.current?.focus()}>Agregar información</button>}
        </div>
      </div>
      <h2 className="mb-3">{t.asunto}</h2>

      {t.estado === 'cerrado' && (
        <div className="card p-3 mb-3 border-success">
          <div className="small">
            <strong>Resuelto el {formatFecha(t.resueltoEn || t.cerradoEn)}</strong>{t.tecnico ? ` por ${t.tecnico}` : ''}. Solución: {t.solucion}
          </div>
          {reabrible ? (
            <div className="d-flex flex-wrap align-items-center gap-2 mt-2">
              <span className="small text-muted">¿La falla volvió? Puedes reabrirlo hasta el {formatFecha(new Date(new Date(t.cerradoEn).getTime() + PLAZO_REAPERTURA_DIAS * 86400000))}.</span>
              <button type="button" className="btn btn-sm btn-outline-primary ms-auto" onClick={() => { setErrorMotivo(null); setModalReabrir(true); }}>Reabrir ticket</button>
            </div>
          ) : <div className="small text-muted mt-1">El plazo de {PLAZO_REAPERTURA_DIAS} días para reabrirlo ya venció. Si la falla volvió, registra un ticket nuevo.</div>}
        </div>
      )}
      {t.estado === 'cancelado' && <div className="alert alert-secondary small">Cancelaste este ticket. Motivo: {t.motivoCancelacion}</div>}
      {t.estado === 'en_espera' && <div className="alert alert-warning small">En espera: {t.motivoEspera}. Retorno estimado: {formatFecha(t.fechaRetorno)}.</div>}
      {t.estado === 'reabierto' && <div className="alert alert-danger small">Reabriste este ticket: {t.motivoReapertura}</div>}

      <div className="row g-3">
        <div className="col-lg-8">
          <div className="card p-3">
            <h3 className="mb-3">Bitácora de la atención</h3>
            <Bitacora entradas={bitacora} />
            {admiteComentarios && (
              <form className="mt-3" onSubmit={enviarComentario} noValidate>
                <FormField id="comentario" label="Agregar información" error={errorTexto} hint={`${texto.length} / ${MAX_DESCRIPCION}`} className="mb-2">
                  <textarea ref={composerRef} id="comentario" rows={3} className={inputClass(errorTexto)} placeholder="Escribe aquí si tienes un dato nuevo que ayude al técnico…" value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={MAX_DESCRIPCION} />
                </FormField>
                <div className="d-flex flex-wrap align-items-center gap-2">
                  <button type="submit" className="btn btn-primary btn-sm" disabled={enviando}>{enviando && <span className="spinner-border spinner-border-sm me-2" />}Enviar comentario</button>
                  <span className="small text-muted">Las notas internas del equipo técnico no se muestran aquí.</span>
                </div>
              </form>
            )}
          </div>
        </div>
        <div className="col-lg-4">
          <div className="card p-3 mb-3">
            <h3 className="mb-2">Datos del reporte</h3>
            <dl className="row small mb-2">
              <dt className="col-5 fw-normal text-muted">Categoría</dt><dd className="col-7 text-end">{t.categoria}</dd>
              <dt className="col-5 fw-normal text-muted">Subcategoría</dt><dd className="col-7 text-end">{t.subcategoria}</dd>
              <dt className="col-5 fw-normal text-muted">Ambiente</dt><dd className="col-7 text-end font-mono">{t.ambiente}</dd>
              <dt className="col-5 fw-normal text-muted">Registrado</dt><dd className="col-7 text-end">{formatFechaHora(t.creadoEn)}</dd>
              <dt className="col-5 fw-normal text-muted">Técnico asignado</dt><dd className="col-7 text-end">{t.tecnico || 'Sin asignar'}</dd>
              {!['cerrado', 'cancelado', 'resuelto'].includes(t.estado) && (<><dt className="col-5 fw-normal text-muted">Atención esperada</dt><dd className={`col-7 text-end ${t.vencido ? 'text-danger' : ''}`}>Antes de {formatHora(t.venceEn)} del {formatFecha(t.venceEn)}</dd></>)}
            </dl>
            <div className="small p-2 rounded" style={{ background: 'var(--color-bg)' }}>«{t.descripcion}»</div>
          </div>
          <div className="card p-3">
            <h3 className="mb-3">Línea de tiempo</h3>
            <ul className="timeline small">
              {eventosLinea.map((e, i) => (
                <li key={i} className={e.tipo === 'asignacion' ? 'evento' : ''}>
                  <div className="fw-medium">{e.tipo === 'asignacion' ? e.titulo : NOMBRE_PASO[e.estado] || e.titulo}</div>
                  <div className="text-muted">{formatFechaHora(e.creadoEn)} · {e.detalle.split(' · ')[0]}</div>
                </li>
              ))}
              {pendientes.map((p) => <li key={p} className="pendiente"><div className="text-muted">{NOMBRE_PASO[p]}</div><div className="text-muted">Pendiente</div></li>)}
            </ul>
          </div>
        </div>
      </div>

      <Modal
        show={modalReabrir}
        title={`Reabrir ${t.codigo}`}
        subtitle="El ticket vuelve al técnico que lo atendió y se reinicia su tiempo esperado."
        onClose={() => setModalReabrir(false)}
        footer={(
          <>
            <button type="button" className="btn btn-outline-primary" onClick={() => setModalReabrir(false)}>Cancelar</button>
            <button type="button" className="btn btn-primary" onClick={reabrir}>Reabrir ticket</button>
          </>
        )}
      >
        <FormField id="motivoReabrir" label="Motivo (obligatorio)" error={errorMotivo} className="">
          <textarea id="motivoReabrir" rows={3} className={inputClass(errorMotivo)} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="La falla volvió a presentarse…" />
        </FormField>
      </Modal>

      <ConfirmDialog
        show={confirmarCancelar}
        title={`¿Cancelar ${t.codigo}?`}
        message="El ticket saldrá de la cola de atención. Esta acción no se puede deshacer."
        confirmLabel="Cancelar ticket"
        cancelLabel="Volver"
        onConfirm={cancelar}
        onCancel={() => setConfirmarCancelar(false)}
      >
        <FormField id="motivoCancelar" label="Motivo (opcional)" className="">
          <input id="motivoCancelar" className="form-control" value={motivoCancelar} onChange={(e) => setMotivoCancelar(e.target.value)} placeholder="Ya se solucionó" />
        </FormField>
      </ConfirmDialog>
    </>
  );
}

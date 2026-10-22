// HU-5 · 5.1 Detalle del ticket · 5.2 bitácora · 5.3 cambiar estado · 5.4 cerrar · Técnico (el supervisor la reutiliza)
// src/pages/tecnico/DetalleTicket.jsx
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { EstadoBadge, PrioridadBadge, nombreEstado } from '../../widgets/Badges';
import Bitacora from '../../widgets/Bitacora';
import Modal from '../../widgets/Modal';
import FormField, { inputClass } from '../../widgets/FormField';
import { useAuth } from '../../context/AuthContext';
import { obtenerTicket, PLAZO_REAPERTURA_DIAS } from '../../services/tickets.service';
import { listarBitacora, agregarEntrada, cambiarEstado, cerrarTicket, opcionesDeEstado, puedeAtender, puedeCerrar, obtenerHistorial, calcularTiempos, DESCRIPCION_ESTADO, TRANSICIONES } from '../../services/atencion.service';
import { ambientesSync, resumenAmbienteSync, ESTADOS_ABIERTOS } from '../../services/catalogo.service';
import { formatFecha, formatFechaHora, formatHora, formatDuracion, plazoTexto, toInputDate } from '../../helpers/datetime';
import NoEncontrado from '../../widgets/NoEncontrado';

export default function DetalleTicket() {
  const { codigo } = useParams();
  const { usuario } = useAuth();
  // Se usa en la app del técnico y en la del supervisor: los enlaces salen del prefijo del rol actual
  const base = `/${usuario.rol}`;
  const esSupervisor = usuario.rol === 'supervisor';
  const [t, setT] = useState(null);
  const [error, setError] = useState(null);
  const [entradas, setEntradas] = useState([]);
  const [historial, setHistorial] = useState(null);
  const [mostrar, setMostrar] = useState('todas');
  const [tipo, setTipo] = useState('publico');
  const [texto, setTexto] = useState('');
  const [errorTexto, setErrorTexto] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [modalEstado, setModalEstado] = useState(false);
  const [estadoForm, setEstadoForm] = useState({ nuevo: '', motivoEspera: '', fechaRetorno: '' });
  const [modalCerrar, setModalCerrar] = useState(false);
  const [solucion, setSolucion] = useState('');
  const [errores, setErrores] = useState({});

  const cargar = useCallback(async () => {
    try {
      const ticket = await obtenerTicket(codigo, usuario);
      if (usuario.rol === 'tecnico' && ticket.tecnicoId !== usuario.id) { setError(403); return; }
      setT(ticket);
      setEntradas(await listarBitacora(ticket.id, { incluirInternas: true }));
      setHistorial(await obtenerHistorial(codigo, usuario));
    } catch (ex) {
      setError(ex.status || 404);
    }
  }, [codigo, usuario]);

  useEffect(() => { cargar(); }, [cargar]);

  const guardarEntrada = async (e) => {
    e.preventDefault();
    setErrorTexto(null);
    setGuardando(true);
    try {
      await agregarEntrada(codigo, usuario, tipo, texto);
      setTexto('');
      toast.success(tipo === 'interno' ? 'Nota interna guardada.' : 'Comentario público publicado.');
      cargar();
    } catch (ex) {
      setErrorTexto(ex.errores?.texto || ex.message);
    } finally {
      setGuardando(false);
    }
  };

  const abrirEstado = () => {
    setErrores({});
    const primera = opcionesDeEstado(t.estado).find((o) => o.permitida)?.estado || '';
    setEstadoForm({ nuevo: primera, motivoEspera: '', fechaRetorno: toInputDate(new Date(Date.now() + 2 * 86400000)) });
    setModalEstado(true);
  };

  const guardarEstado = async () => {
    setErrores({});
    try {
      const r = await cambiarEstado(codigo, usuario, estadoForm.nuevo, estadoForm);
      toast.success(`${r.codigo} pasó a ${nombreEstado(r.estado)}.`);
      setModalEstado(false);
      cargar();
    } catch (ex) {
      if (ex.errores) setErrores(ex.errores);
      else toast.error(ex.message);
    }
  };

  const guardarCierre = async () => {
    setErrores({});
    try {
      await cerrarTicket(codigo, usuario, solucion);
      toast.success(`${codigo} cerrado. ${t.solicitante} podrá reabrirlo dentro de ${PLAZO_REAPERTURA_DIAS} días.`);
      setModalCerrar(false);
      setSolucion('');
      cargar();
    } catch (ex) {
      if (ex.errores) setErrores(ex.errores);
      else toast.error(ex.message);
    }
  };

  if (error === 403) return <NoEncontrado codigo={403} titulo="No tienes permiso para ver este ticket" mensaje="Este ticket no está asignado a ti. Si debes atenderlo, pide al supervisor que te lo asigne." />;
  if (error) return <NoEncontrado />;
  if (!t || !historial) return <div className="text-center py-5"><span className="spinner-border text-primary" /></div>;

  const atiende = puedeAtender(t, usuario);
  const editable = atiende && !['cerrado', 'cancelado'].includes(t.estado);
  const filtradas = entradas.filter((e) => mostrar === 'todas' || e.tipo === mostrar);
  const ambiente = ambientesSync().find((a) => a.id === t.ambienteId);
  const resumenAmbiente = resumenAmbienteSync(t.ambienteId);
  const tiempos = calcularTiempos(t);
  const esperado = Math.round((new Date(t.venceEn) - new Date(t.creadoEn)) / 3600000);
  const dentroDePlazo = tiempos.atencion <= esperado * 3600000;
  const cadena = historial.eventos.filter((e) => e.tipo !== 'prioridad').slice(-4)
    .map((e) => `${e.tipo === 'asignacion' ? 'Asignado' : nombreEstado(e.estado)} ${formatHora(e.creadoEn)}`).join(' → ');

  return (
    <>
      <nav className="small text-muted mb-1">
        <Link to={esSupervisor ? `${base}/cola` : `${base}/bandeja`}>{esSupervisor ? 'Cola de atención' : 'Mi bandeja'}</Link> · {t.codigo}
      </nav>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
        <span className="big-code" style={{ fontSize: 24 }}>{t.codigo}</span>
        <PrioridadBadge prioridad={t.prioridad} />
        <EstadoBadge estado={t.estado} />
        {ESTADOS_ABIERTOS.includes(t.estado) && t.estado !== 'en_espera' && <span className={`small ${t.vencido ? 'text-danger fw-semibold' : 'text-muted'}`}>{plazoTexto(t.venceEn)}</span>}
        <div className="ms-auto d-flex flex-wrap gap-2">
          {editable && TRANSICIONES[t.estado] && <button type="button" className="btn btn-primary btn-sm" onClick={abrirEstado} disabled={!t.tecnicoId}>Cambiar estado</button>}
          {editable && puedeCerrar(t) && <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => { setErrores({}); setModalCerrar(true); }}>Cerrar ticket</button>}
          <Link to={`${base}/tickets/${t.codigo}/historial`} className="btn btn-link btn-sm">Historial</Link>
        </div>
      </div>
      <h2 className="mb-3">{t.asunto} · {t.categoria}</h2>

      {!t.tecnicoId && ESTADOS_ABIERTOS.includes(t.estado) && <div className="alert alert-info small">Este ticket aún no tiene técnico. Asígnalo desde la <Link to={`${base}/cola`}>cola de atención</Link> para iniciar la atención.</div>}
      {t.estado === 'en_espera' && <div className="alert alert-warning small">En espera: {t.motivoEspera} · retorno estimado {formatFecha(t.fechaRetorno)}. El tiempo en espera no cuenta para el tiempo esperado.</div>}
      {t.estado === 'reabierto' && <div className="alert alert-danger small">Reabierto por el usuario: {t.motivoReapertura}</div>}
      {t.estado === 'cerrado' && <div className="alert alert-success small">Cerrado el {formatFechaHora(t.cerradoEn)}. Solución: {t.solucion}</div>}

      <div className="row g-3">
        <div className="col-lg-8">
          <div className="card p-3">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h3 className="mb-0">Bitácora · {entradas.length} entradas</h3>
              <select className="form-select form-select-sm" style={{ width: 'auto' }} value={mostrar} onChange={(e) => setMostrar(e.target.value)} aria-label="Mostrar entradas">
                <option value="todas">Mostrar: todas</option>
                <option value="publico">Solo comentarios públicos</option>
                <option value="interno">Solo notas internas</option>
              </select>
            </div>
            <Bitacora entradas={filtradas} />
            {editable && (
              <form className={`composer card p-3 mt-3 ${tipo === 'interno' ? 'interna' : ''}`} onSubmit={guardarEntrada} noValidate>
                <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                  <div className="btn-group btn-group-sm" role="group" aria-label="Tipo de entrada">
                    <button type="button" className={`btn ${tipo === 'publico' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setTipo('publico')}>Comentario público</button>
                    <button type="button" className={`btn ${tipo === 'interno' ? 'btn-warning' : 'btn-outline-primary'}`} onClick={() => setTipo('interno')}>Nota interna</button>
                  </div>
                  <span className={`small ${tipo === 'interno' ? 'text-warning' : 'text-muted'}`}>
                    {tipo === 'interno' ? 'Estás escribiendo una nota interna: solo la ve el equipo técnico y el supervisor.' : 'El usuario verá este comentario en su vista del ticket.'}
                  </span>
                </div>
                <FormField id="entrada" error={errorTexto} hint={`${texto.length} / 600`} className="mb-2">
                  <textarea id="entrada" rows={3} className={inputClass(errorTexto)} value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={600} placeholder="Describe el avance de la atención…" aria-label="Detalle del avance" />
                </FormField>
                <div>
                  <button type="submit" className={`btn btn-sm ${tipo === 'interno' ? 'btn-warning' : 'btn-primary'}`} disabled={guardando}>
                    {guardando && <span className="spinner-border spinner-border-sm me-2" />}{tipo === 'interno' ? 'Guardar nota interna' : 'Publicar comentario'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
        <div className="col-lg-4">
          <div className="card p-3 mb-3">
            <h3 className="mb-2">Datos del reporte</h3>
            <dl className="row small mb-2">
              <dt className="col-5 fw-normal text-muted">Solicitante</dt><dd className="col-7 text-end">{t.solicitante}</dd>
              <dt className="col-5 fw-normal text-muted">Teléfono</dt><dd className="col-7 text-end">{t.solicitanteTelefono}</dd>
              <dt className="col-5 fw-normal text-muted">Subcategoría</dt><dd className="col-7 text-end">{t.subcategoria}</dd>
              <dt className="col-5 fw-normal text-muted">Registrado</dt><dd className="col-7 text-end">{formatFechaHora(t.creadoEn)}</dd>
              <dt className="col-5 fw-normal text-muted">Técnico</dt><dd className="col-7 text-end">{t.tecnico || 'Sin asignar'}</dd>
              {t.prioridadSugerida !== t.prioridad && (<><dt className="col-5 fw-normal text-muted">Sugerida</dt><dd className="col-7 text-end"><PrioridadBadge prioridad={t.prioridadSugerida} /></dd></>)}
            </dl>
            <div className="small p-2 rounded" style={{ background: 'var(--color-bg)' }}>«{t.descripcion}»</div>
          </div>
          <div className="card p-3 mb-3">
            <h3 className="mb-1">Ambiente</h3>
            <div className="ticket-code mb-1">{ambiente?.codigo}</div>
            <div className="small text-muted mb-1">{t.ambienteDetalle}</div>
            <div className="small">{resumenAmbiente.abiertos} tickets abiertos en este ambiente{resumenAmbiente.ultimoCierre ? ` · último cierre ${formatFecha(resumenAmbiente.ultimoCierre)}` : ''}</div>
          </div>
          <div className="card p-3">
            <h3 className="mb-1">Historial reciente</h3>
            <div className="small text-muted">{cadena} · {formatDuracion(tiempos.total)} transcurridos</div>
          </div>
        </div>
      </div>

      {/* 5.3 Cambiar estado */}
      <Modal
        show={modalEstado}
        title={`Cambiar estado de ${t.codigo}`}
        subtitle={`Estado actual: ${nombreEstado(t.estado)}. Solo se ofrecen las transiciones permitidas.`}
        onClose={() => setModalEstado(false)}
        footer={(
          <>
            <button type="button" className="btn btn-outline-primary" onClick={() => setModalEstado(false)}>Cancelar</button>
            <button type="button" className="btn btn-primary" onClick={guardarEstado} disabled={!estadoForm.nuevo}>Guardar estado</button>
          </>
        )}
      >
        <div className="d-flex flex-column gap-2 mb-3" role="radiogroup">
          {opcionesDeEstado(t.estado).map((o) => (
            <label key={o.estado} className={`option-card d-flex align-items-center gap-2 mb-0 ${!o.permitida ? 'disabled' : ''} ${estadoForm.nuevo === o.estado ? (o.estado === 'en_espera' ? 'selected-warning' : 'selected') : ''}`}>
              <input type="radio" className="form-check-input mt-0" name="nuevoEstado" disabled={!o.permitida} checked={estadoForm.nuevo === o.estado} onChange={() => setEstadoForm({ ...estadoForm, nuevo: o.estado })} />
              <span className="small">
                <strong>{nombreEstado(o.estado)}</strong> · {o.permitida ? DESCRIPCION_ESTADO[o.estado] : `no disponible desde ${nombreEstado(t.estado)}`}
              </span>
            </label>
          ))}
        </div>
        {estadoForm.nuevo === 'en_espera' && (
          <div className="row g-3">
            <div className="col-sm-7">
              <FormField id="motivoEspera" label="Motivo de espera (obligatorio)" error={errores.motivoEspera} className="">
                <textarea id="motivoEspera" rows={2} className={inputClass(errores.motivoEspera)} value={estadoForm.motivoEspera} onChange={(e) => setEstadoForm({ ...estadoForm, motivoEspera: e.target.value })} placeholder="Repuesto solicitado al almacén con guía 4471." />
              </FormField>
            </div>
            <div className="col-sm-5">
              <FormField id="fechaRetorno" label="Fecha estimada de retorno" error={errores.fechaRetorno} className="">
                <input id="fechaRetorno" type="date" min={toInputDate()} className={inputClass(errores.fechaRetorno)} value={estadoForm.fechaRetorno} onChange={(e) => setEstadoForm({ ...estadoForm, fechaRetorno: e.target.value })} />
              </FormField>
            </div>
          </div>
        )}
      </Modal>

      {/* 5.4 Cerrar ticket */}
      <Modal
        show={modalCerrar}
        title={`Cerrar ${t.codigo}`}
        onClose={() => setModalCerrar(false)}
        footer={(
          <>
            <button type="button" className="btn btn-outline-primary" onClick={() => setModalCerrar(false)}>Cancelar</button>
            <button type="button" className="btn btn-primary" onClick={guardarCierre}>Cerrar ticket</button>
          </>
        )}
      >
        <FormField id="solucion" label="Solución aplicada (obligatoria)" error={errores.solucion}>
          <textarea id="solucion" rows={3} className={inputClass(errores.solucion)} value={solucion} onChange={(e) => setSolucion(e.target.value)} maxLength={600} placeholder="Se reemplazó el extensor HDBaseT del rack del piso 2 y se verificó la proyección." />
        </FormField>
        <div className="row g-2 mb-3">
          <div className="col-7">
            <div className="card p-2 h-100">
              <div className="label-caps">Tiempo total de atención</div>
              <div className="fs-5 fw-semibold">{formatDuracion(tiempos.atencion)}</div>
              <div className={`small ${dentroDePlazo ? 'text-success' : 'text-danger'}`}>{dentroDePlazo ? 'Dentro' : 'Fuera'} del tiempo esperado ({esperado} h)</div>
              {tiempos.espera > 0 && <div className="small text-muted">Sin contar {formatDuracion(tiempos.espera)} en espera</div>}
            </div>
          </div>
          <div className="col-5">
            <div className="card p-2 h-100">
              <div className="label-caps mb-1">Estado final</div>
              <div><EstadoBadge estado="cerrado" /></div>
            </div>
          </div>
        </div>
        <div className="surface-soft small p-2">Al cerrar, {t.solicitante} podrá reabrir el ticket dentro de {PLAZO_REAPERTURA_DIAS} días.</div>
      </Modal>
    </>
  );
}

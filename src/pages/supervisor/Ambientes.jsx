// HU-2 · 2.3 Sedes y ambientes · Supervisor (alta y edición en modal)
// src/pages/supervisor/Ambientes.jsx
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faBuilding } from '@fortawesome/free-solid-svg-icons';
import Modal from '../../widgets/Modal';
import ConfirmDialog from '../../widgets/ConfirmDialog';
import EmptyState from '../../widgets/EmptyState';
import FormField, { inputClass } from '../../widgets/FormField';
import Paginacion, { paginar } from '../../widgets/Paginacion';
import { listarAmbientes, listarSedes, guardarAmbiente, eliminarAmbiente, TIPOS_AMBIENTE, nombreTipoAmbiente, ambientesSync } from '../../services/catalogo.service';

const FILTROS = { busqueda: '', sedeId: '', pabellon: '', tipo: '' };
const VACIO = { codigo: '', nombre: '', tipo: 'aula', sedeId: 1, pabellon: '', piso: 1, capacidad: 30 };

export default function Ambientes() {
  const [filtros, setFiltros] = useState(FILTROS);
  const [lista, setLista] = useState([]);
  const [sedes, setSedes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [pagina, setPagina] = useState(1);
  const [modal, setModal] = useState(null);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [aEliminar, setAEliminar] = useState(null);
  const pabellones = [...new Set(ambientesSync().map((a) => a.pabellon))].sort();
  const info = paginar(lista, pagina, 10);
  const sedeFiltro = sedes.find((s) => s.id === Number(filtros.sedeId));

  const cargar = useCallback(() => {
    setCargando(true);
    listarAmbientes(filtros).then(setLista).finally(() => setCargando(false));
  }, [filtros]);

  useEffect(() => { listarSedes().then(setSedes); }, []);
  useEffect(() => { cargar(); setPagina(1); }, [cargar]);

  const cambiarFiltro = (e) => setFiltros({ ...filtros, [e.target.name]: e.target.value });
  const abrir = (amb = VACIO) => { setErrores({}); setModal({ ...amb }); };
  const cambiar = (e) => setModal({ ...modal, [e.target.name]: e.target.value });

  const guardar = async (e) => {
    e?.preventDefault();
    setGuardando(true);
    try {
      const g = await guardarAmbiente(modal);
      toast.success(`Ambiente ${g.codigo} ${modal.id ? 'actualizado' : 'creado'} correctamente.`);
      setModal(null);
      cargar();
    } catch (ex) {
      if (ex.errores) setErrores(ex.errores);
      toast.error(ex.message);
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async () => {
    try {
      await eliminarAmbiente(aEliminar.id);
      toast.success(`Ambiente ${aEliminar.codigo} eliminado.`);
      cargar();
    } catch (ex) {
      toast.error(ex.message);
    }
    setAEliminar(null);
  };

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
        <div>
          <h1 className="mb-1">Sedes y ambientes</h1>
          <p className="text-muted mb-0">{lista.length} ambientes registrados{sedeFiltro ? ` en ${sedeFiltro.nombre}` : ` en ${sedes.length} sedes`}.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => abrir()}><FontAwesomeIcon icon={faPlus} className="me-2" />Nuevo ambiente</button>
      </div>

      <div className="d-flex flex-wrap gap-2 mb-3">
        <input name="busqueda" className="form-control" style={{ maxWidth: 260 }} placeholder="Buscar por código o nombre" value={filtros.busqueda} onChange={cambiarFiltro} aria-label="Buscar ambiente" />
        <select name="sedeId" className="form-select" style={{ maxWidth: 220 }} value={filtros.sedeId} onChange={cambiarFiltro} aria-label="Sede">
          <option value="">Sede: todas</option>
          {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
        <select name="pabellon" className="form-select" style={{ maxWidth: 180 }} value={filtros.pabellon} onChange={cambiarFiltro} aria-label="Pabellón">
          <option value="">Pabellón: todos</option>
          {pabellones.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select name="tipo" className="form-select" style={{ maxWidth: 180 }} value={filtros.tipo} onChange={cambiarFiltro} aria-label="Tipo">
          <option value="">Tipo: todos</option>
          {TIPOS_AMBIENTE.map((t) => <option key={t.codigo} value={t.codigo}>{t.nombre}</option>)}
        </select>
        {JSON.stringify(filtros) !== JSON.stringify(FILTROS) && <button type="button" className="btn btn-link btn-sm" onClick={() => setFiltros(FILTROS)}>Limpiar filtros</button>}
      </div>

      <div className="card">
        {cargando ? <div className="text-center py-5"><span className="spinner-border text-primary" /></div>
          : lista.length === 0 ? (
            <EmptyState icon={faBuilding} title="No hay ambientes con estos filtros" message="Prueba con otra búsqueda o registra un ambiente nuevo." action={<button type="button" className="btn btn-primary" onClick={() => setFiltros(FILTROS)}>Quitar filtros</button>} />
          ) : (
            <>
              <div className="table-responsive">
                <table className="table table-app">
                  <thead><tr><th>Código</th><th>Tipo de ambiente</th><th>Pabellón</th><th>Piso</th><th>Sede</th><th>Capacidad</th><th className="text-center">Tickets abiertos</th><th className="text-end">Acciones</th></tr></thead>
                  <tbody>
                    {info.items.map((a) => (
                      <tr key={a.id}>
                        <td className="font-mono fw-semibold">{a.codigo}</td>
                        <td>{a.nombre}<div className="small text-muted">{nombreTipoAmbiente(a.tipo)}</div></td>
                        <td>{a.pabellon}</td>
                        <td>{a.piso}</td>
                        <td>{a.sede}</td>
                        <td>{a.capacidad}</td>
                        <td className="text-center">{a.ticketsAbiertos}</td>
                        <td className="text-end text-nowrap">
                          <button type="button" className="btn btn-sm btn-tertiary" onClick={() => abrir(a)}>Editar</button>
                          <button type="button" className="btn btn-sm btn-tertiary text-danger" onClick={() => setAEliminar(a)}>Eliminar</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Paginacion info={info} onChange={setPagina} etiqueta="ambientes" />
            </>
          )}
      </div>

      <Modal
        show={!!modal}
        title={modal?.id ? `Editar ${modal.codigo}` : 'Nuevo ambiente'}
        onClose={() => setModal(null)}
        footer={(
          <>
            <button type="button" className="btn btn-outline-primary" onClick={() => setModal(null)}>Cancelar</button>
            <button type="button" className="btn btn-primary" onClick={guardar} disabled={guardando}>{guardando && <span className="spinner-border spinner-border-sm me-2" />}Guardar ambiente</button>
          </>
        )}
      >
        {modal && (
          <form className="row g-3" onSubmit={guardar} noValidate>
            <div className="col-6"><FormField id="codigo" label="Código" error={errores.codigo} className=""><input id="codigo" name="codigo" className={`${inputClass(errores.codigo)} font-mono`} value={modal.codigo} onChange={cambiar} placeholder="H-212" /></FormField></div>
            <div className="col-6"><FormField id="tipo" label="Tipo" error={errores.tipo} className=""><select id="tipo" name="tipo" className={inputClass(errores.tipo, 'form-select')} value={modal.tipo} onChange={cambiar}>{TIPOS_AMBIENTE.map((t) => <option key={t.codigo} value={t.codigo}>{t.nombre}</option>)}</select></FormField></div>
            <div className="col-12"><FormField id="nombreAmb" label="Nombre" error={errores.nombre} className=""><input id="nombreAmb" name="nombre" className={inputClass(errores.nombre)} value={modal.nombre} onChange={cambiar} placeholder="Laboratorio de Redes" /></FormField></div>
            <div className="col-12"><FormField id="sedeId" label="Sede" error={errores.sedeId} className=""><select id="sedeId" name="sedeId" className={inputClass(errores.sedeId, 'form-select')} value={modal.sedeId} onChange={cambiar}>{sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select></FormField></div>
            <div className="col-4"><FormField id="pabellon" label="Pabellón" error={errores.pabellon} className=""><input id="pabellon" name="pabellon" className={inputClass(errores.pabellon)} value={modal.pabellon} onChange={cambiar} /></FormField></div>
            <div className="col-4"><FormField id="piso" label="Piso" error={errores.piso} className=""><input id="piso" name="piso" type="number" className={inputClass(errores.piso)} value={modal.piso} onChange={cambiar} /></FormField></div>
            <div className="col-4"><FormField id="capacidad" label="Capacidad" error={errores.capacidad} className=""><input id="capacidad" name="capacidad" type="number" min="1" className={inputClass(errores.capacidad)} value={modal.capacidad} onChange={cambiar} /></FormField></div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        show={!!aEliminar}
        title={`¿Eliminar el ambiente ${aEliminar?.codigo}?`}
        message="Dejará de aparecer al registrar tickets. No se puede eliminar si ya tiene tickets registrados."
        confirmLabel="Eliminar"
        onConfirm={eliminar}
        onCancel={() => setAEliminar(null)}
      />
    </>
  );
}

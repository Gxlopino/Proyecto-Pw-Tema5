// HU-2 · 2.2 Nueva / editar categoría · Supervisor
// src/pages/supervisor/CategoriaForm.jsx
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import FormField, { inputClass } from '../../widgets/FormField';
import { LISTA_PRIORIDADES } from '../../widgets/Badges';
import { obtenerCategoria, guardarCategoria, categoriasSync, prioridadesSync, horasPorPrioridad } from '../../services/catalogo.service';
import NoEncontrado from '../../widgets/NoEncontrado';

const VACIA = { nombre: '', parentId: '', prioridadDefecto: 'media', tiempoEsperadoHoras: 24, descripcion: '', activa: true };

export default function CategoriaForm() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const editando = !!id;
  const [form, setForm] = useState({ ...VACIA, parentId: params.get('parent') || '' });
  const [errores, setErrores] = useState({});
  const [mensaje, setMensaje] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [noExiste, setNoExiste] = useState(false);
  const padres = categoriasSync().filter((c) => c.parentId === null && c.id !== Number(id));
  const referencia = prioridadesSync().map((p) => `${p.nombre} ${p.horas} h`).join(' · ');
  const esSub = !!form.parentId;

  useEffect(() => {
    if (!editando) return;
    obtenerCategoria(id)
      .then((c) => setForm({ ...c, parentId: c.parentId ?? '' }))
      .catch(() => setNoExiste(true));
  }, [id, editando]);

  const cambiar = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const elegirPrioridad = (codigo) => {
    setForm((f) => {
      // Si el tiempo seguía la referencia de la prioridad anterior, se actualiza solo
      const seguiaReferencia = Number(f.tiempoEsperadoHoras) === horasPorPrioridad(f.prioridadDefecto) || !f.tiempoEsperadoHoras;
      return { ...f, prioridadDefecto: codigo, tiempoEsperadoHoras: seguiaReferencia ? horasPorPrioridad(codigo) : f.tiempoEsperadoHoras };
    });
  };

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setErrores({});
    setMensaje(null);
    try {
      const datos = { ...form, id: editando ? Number(id) : undefined };
      const guardada = await guardarCategoria(datos);
      toast.success(`${guardada.parentId ? 'Subcategoría' : 'Categoría'} "${guardada.nombre}" ${editando ? 'actualizada' : 'creada'} correctamente.`);
      navigate('/supervisor/categorias');
    } catch (ex) {
      if (ex.errores) {
        setErrores(ex.errores);
        setMensaje(`No se pudo guardar: revisa los ${Object.keys(ex.errores).length} campos marcados.`);
      } else {
        toast.error(ex.message);
      }
    } finally {
      setGuardando(false);
    }
  };

  if (noExiste) return <NoEncontrado />;
  const titulo = `${editando ? 'Editar' : 'Nueva'} ${esSub ? 'subcategoría' : 'categoría'}`;

  return (
    <>
      <nav className="small text-muted mb-1"><Link to="/supervisor/categorias">Categorías</Link> · {titulo}</nav>
      <h1 className="mb-3">{titulo}</h1>
      <div className="row g-3">
        <div className="col-lg-8">
          <form className="card p-4" onSubmit={guardar} noValidate>
            {mensaje && <div className="alert alert-danger small" role="alert">{mensaje}</div>}
            <fieldset disabled={guardando}>
              <div className="row g-3">
                <div className="col-md-6">
                  <FormField id="nombre" label="Nombre" error={errores.nombre} className="">
                    <input id="nombre" name="nombre" className={inputClass(errores.nombre)} value={form.nombre} onChange={cambiar} placeholder="Escribe el nombre" maxLength={60} />
                  </FormField>
                </div>
                <div className="col-md-6">
                  <FormField id="parentId" label="Categoría padre" error={errores.parentId} hint="Déjalo vacío para crear una categoría de primer nivel." className="">
                    <select id="parentId" name="parentId" className={inputClass(errores.parentId, 'form-select')} value={form.parentId} onChange={cambiar}>
                      <option value="">— Ninguna (primer nivel) —</option>
                      {padres.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                  </FormField>
                </div>
                <div className="col-md-7">
                  <div className="form-label">Prioridad por defecto</div>
                  <div className="btn-group w-100" role="group" aria-label="Prioridad por defecto">
                    {LISTA_PRIORIDADES.map((p) => (
                      <React.Fragment key={p.codigo}>
                        <input type="radio" className="btn-check" name="prioridadDefecto" id={`p-${p.codigo}`} checked={form.prioridadDefecto === p.codigo} onChange={() => elegirPrioridad(p.codigo)} />
                        <label className="btn btn-outline-primary" htmlFor={`p-${p.codigo}`}>{p.nombre}</label>
                      </React.Fragment>
                    ))}
                  </div>
                  {errores.prioridadDefecto && <div className="invalid-feedback d-block">{errores.prioridadDefecto}</div>}
                </div>
                <div className="col-md-5">
                  <FormField id="tiempoEsperadoHoras" label="Tiempo esperado (horas)" error={errores.tiempoEsperadoHoras} className="">
                    <input id="tiempoEsperadoHoras" name="tiempoEsperadoHoras" type="number" min="1" className={inputClass(errores.tiempoEsperadoHoras)} value={form.tiempoEsperadoHoras} onChange={cambiar} />
                  </FormField>
                </div>
                <div className="col-12">
                  <FormField id="descripcion" label="Descripción" error={errores.descripcion} hint={`Se muestra al usuario al elegir la subcategoría. ${form.descripcion.length} / 240 caracteres.`} className="">
                    <textarea id="descripcion" name="descripcion" rows={3} className={inputClass(errores.descripcion)} value={form.descripcion} onChange={cambiar} maxLength={260} />
                  </FormField>
                </div>
                <div className="col-12">
                  <div className="form-check">
                    <input className="form-check-input" type="checkbox" id="activa" name="activa" checked={form.activa} onChange={cambiar} />
                    <label className="form-check-label" htmlFor="activa">Categoría activa · disponible al registrar tickets</label>
                  </div>
                </div>
              </div>
              <div className="d-flex gap-2 mt-4">
                <button type="submit" className="btn btn-primary">{guardando && <span className="spinner-border spinner-border-sm me-2" />}Guardar categoría</button>
                <Link to="/supervisor/categorias" className="btn btn-outline-primary">Cancelar</Link>
              </div>
            </fieldset>
          </form>
        </div>
        <div className="col-lg-4">
          <div className="card p-4">
            <h3>Efecto del tiempo esperado</h3>
            <p className="small text-muted">El tiempo esperado define cuándo un ticket aparece como fuera de plazo en la cola. Cambiarlo no altera los tickets ya abiertos.</p>
            <div className="label-caps mb-1">Referencia actual</div>
            <div className="small">{referencia} hábiles</div>
          </div>
        </div>
      </div>
    </>
  );
}

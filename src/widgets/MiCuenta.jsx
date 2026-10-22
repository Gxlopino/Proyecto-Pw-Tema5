// HU-1 · 1.6 Mi cuenta · todos los roles con sesión (/<rol>/mi-cuenta)
// src/widgets/MiCuenta.jsx
import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import FormField, { inputClass } from './FormField';
import { useAuth } from '../context/AuthContext';
import { actualizarCuenta, cambiarPassword, listarUnidades, nombreCompleto, iniciales } from '../services/auth.service';
import { ambientesSync, categoriasSync } from '../services/catalogo.service';
import { resumenUsuarioSync } from '../services/tickets.service';
import { ROLES } from '../helpers/navigation';
import { formatFecha, formatFechaHora } from '../helpers/datetime';

const datosDe = (u) => ({
  nombres: u.nombres,
  apellidos: u.apellidos,
  telefono: u.telefono,
  unidad: u.unidad,
  ambienteHabitualId: u.ambienteHabitualId || '',
});

export default function MiCuenta() {
  const { usuario, refrescar } = useAuth();
  const [form, setForm] = useState(datosDe(usuario));
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [pass, setPass] = useState({ actual: '', nueva: '', confirmar: '' });
  const [erroresPass, setErroresPass] = useState({});
  const [guardandoPass, setGuardandoPass] = useState(false);
  const [unidades, setUnidades] = useState([]);
  const ambientes = ambientesSync();
  const resumen = usuario.rol === 'usuario' ? resumenUsuarioSync(usuario.id) : null;
  const especialidades = categoriasSync().filter((c) => usuario.especialidades?.includes(c.id)).map((c) => c.nombre);
  const cambios = JSON.stringify(form) !== JSON.stringify(datosDe(usuario));

  useEffect(() => { listarUnidades().then(setUnidades); }, []);

  const cambiar = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setErrores({});
    try {
      await actualizarCuenta(form);
      await refrescar();
      toast.success('Tus datos se actualizaron correctamente.');
    } catch (ex) {
      if (ex.errores) setErrores(ex.errores);
      toast.error(ex.message);
    } finally {
      setGuardando(false);
    }
  };

  const guardarPass = async (e) => {
    e.preventDefault();
    setGuardandoPass(true);
    setErroresPass({});
    try {
      await cambiarPassword(pass);
      setPass({ actual: '', nueva: '', confirmar: '' });
      toast.success('Contraseña actualizada.');
    } catch (ex) {
      if (ex.errores) setErroresPass(ex.errores);
      toast.error(ex.message);
    } finally {
      setGuardandoPass(false);
    }
  };

  return (
    <>
      <h1 className="mb-1">Mi cuenta</h1>
      <p className="text-muted">Tus datos se usan para contactarte durante la atención de un ticket.</p>
      <div className="row g-3">
        <div className="col-lg-8">
          <form className="card p-4 mb-3" onSubmit={guardar} noValidate>
            <h2 className="mb-3">Datos personales</h2>
            <fieldset disabled={guardando}>
              <div className="row g-3">
                <div className="col-md-6">
                  <FormField id="nombres" label="Nombres" error={errores.nombres} className="">
                    <input id="nombres" name="nombres" className={inputClass(errores.nombres)} value={form.nombres} onChange={cambiar} maxLength={60} />
                  </FormField>
                </div>
                <div className="col-md-6">
                  <FormField id="apellidos" label="Apellidos" error={errores.apellidos} className="">
                    <input id="apellidos" name="apellidos" className={inputClass(errores.apellidos)} value={form.apellidos} onChange={cambiar} maxLength={60} />
                  </FormField>
                </div>
                <div className="col-md-6">
                  <FormField id="email" label="Correo institucional" hint="No editable." className="">
                    <input id="email" className="form-control" value={usuario.email} disabled readOnly />
                  </FormField>
                </div>
                <div className="col-md-6">
                  <FormField id="telefono" label="Teléfono" error={errores.telefono} className="">
                    <input id="telefono" name="telefono" className={inputClass(errores.telefono)} value={form.telefono} onChange={cambiar} />
                  </FormField>
                </div>
                <div className="col-md-6">
                  <FormField id="unidad" label="Unidad o carrera" className="">
                    <select id="unidad" name="unidad" className="form-select" value={form.unidad} onChange={cambiar}>
                      {unidades.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </FormField>
                </div>
                {usuario.rol === 'usuario' && (
                  <div className="col-md-6">
                    <FormField id="ambienteHabitualId" label="Ambiente habitual" hint="Se propone al registrar un ticket." className="">
                      <select id="ambienteHabitualId" name="ambienteHabitualId" className="form-select" value={form.ambienteHabitualId} onChange={cambiar}>
                        <option value="">Sin ambiente habitual</option>
                        {ambientes.map((a) => <option key={a.id} value={a.id}>{a.codigo} · {a.nombre}</option>)}
                      </select>
                    </FormField>
                  </div>
                )}
              </div>
              <div className="d-flex gap-2 mt-4">
                <button type="submit" className="btn btn-primary" disabled={!cambios}>{guardando && <span className="spinner-border spinner-border-sm me-2" />}Guardar cambios</button>
                <button type="button" className="btn btn-outline-primary" disabled={!cambios} onClick={() => { setForm(datosDe(usuario)); setErrores({}); }}>Descartar</button>
              </div>
            </fieldset>
          </form>

          <form className="card p-4" onSubmit={guardarPass} noValidate>
            <h2 className="mb-3">Cambiar contraseña</h2>
            <fieldset disabled={guardandoPass}>
              <div className="row g-3">
                <div className="col-md-4">
                  <FormField id="actual" label="Actual" error={erroresPass.actual} className="">
                    <input id="actual" type="password" autoComplete="current-password" className={inputClass(erroresPass.actual)} value={pass.actual} onChange={(e) => setPass({ ...pass, actual: e.target.value })} />
                  </FormField>
                </div>
                <div className="col-md-4">
                  <FormField id="nueva" label="Nueva" error={erroresPass.nueva} className="">
                    <input id="nueva" type="password" autoComplete="new-password" className={inputClass(erroresPass.nueva)} value={pass.nueva} onChange={(e) => setPass({ ...pass, nueva: e.target.value })} />
                  </FormField>
                </div>
                <div className="col-md-4">
                  <FormField id="confirmarPass" label="Confirmar" error={erroresPass.confirmar} className="">
                    <input id="confirmarPass" type="password" autoComplete="new-password" className={inputClass(erroresPass.confirmar)} value={pass.confirmar} onChange={(e) => setPass({ ...pass, confirmar: e.target.value })} />
                  </FormField>
                </div>
              </div>
              <button type="submit" className="btn btn-primary mt-4">{guardandoPass && <span className="spinner-border spinner-border-sm me-2" />}Actualizar contraseña</button>
            </fieldset>
          </form>
        </div>

        <div className="col-lg-4">
          <div className="card p-4">
            <div className="d-flex align-items-center gap-3 mb-3">
              <span className="avatar" style={{ width: 48, height: 48, fontSize: 16 }}>{iniciales(usuario)}</span>
              <div>
                <div className="fw-semibold">{nombreCompleto(usuario)}</div>
                <div className="small text-muted">{ROLES[usuario.rol]}{usuario.vinculo && usuario.rol === 'usuario' ? ` · ${usuario.vinculo}` : ''}</div>
              </div>
            </div>
            <dl className="row small mb-0">
              {resumen && (<><dt className="col-7 fw-normal text-muted">Tickets reportados</dt><dd className="col-5 text-end fw-semibold">{resumen.total}</dd>
                <dt className="col-7 fw-normal text-muted">Abiertos ahora</dt><dd className="col-5 text-end fw-semibold">{resumen.abiertos}</dd></>)}
              {especialidades.length > 0 && (<><dt className="col-5 fw-normal text-muted">Especialidad</dt><dd className="col-7 text-end">{especialidades.join(', ')}</dd></>)}
              <dt className="col-6 fw-normal text-muted">Cuenta creada</dt><dd className="col-6 text-end">{formatFecha(usuario.creadoEn)}</dd>
              <dt className="col-6 fw-normal text-muted">Último acceso</dt><dd className="col-6 text-end mb-0">{formatFechaHora(usuario.ultimoAcceso)}</dd>
            </dl>
          </div>
        </div>
      </div>
    </>
  );
}

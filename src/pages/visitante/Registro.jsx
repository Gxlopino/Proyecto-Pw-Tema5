// HU-1 · 1.3 Registro de usuario · Visitante (validación en línea)
// src/pages/visitante/Registro.jsx
import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import FormField, { inputClass } from '../../widgets/FormField';
import { registrar, validarRegistro, emailDisponible, listarUnidades } from '../../services/auth.service';

const INICIAL = { nombres: '', apellidos: '', email: '', telefono: '', password: '', confirmar: '', unidad: '', vinculo: '', terminos: false };
const VINCULOS = [
  { codigo: 'alumno', nombre: 'Alumno(a)' },
  { codigo: 'docente', nombre: 'Docente' },
  { codigo: 'administrativo', nombre: 'Administrativo' },
  { codigo: 'otro', nombre: 'Otro' },
];

export default function Registro() {
  const [form, setForm] = useState(INICIAL);
  const [tocados, setTocados] = useState({});
  const [errores, setErrores] = useState({});
  const [emailOk, setEmailOk] = useState(false);
  const [unidades, setUnidades] = useState([]);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => { listarUnidades().then(setUnidades); }, []);

  const validar = (datos) => setErrores(validarRegistro(datos));

  const cambiar = (e) => {
    const { name, value, type, checked } = e.target;
    const datos = { ...form, [name]: type === 'checkbox' ? checked : value };
    setForm(datos);
    if (name === 'email') setEmailOk(false);
    validar(datos);
  };

  const salir = async (e) => {
    const { name } = e.target;
    setTocados((t) => ({ ...t, [name]: true }));
    if (name === 'email' && !validarRegistro(form).email) {
      const libre = await emailDisponible(form.email);
      setEmailOk(libre);
      if (!libre) setErrores((er) => ({ ...er, email: 'Ese correo ya tiene una cuenta.' }));
    }
  };

  const err = (campo) => (tocados[campo] ? errores[campo] : null);

  const enviar = async (e) => {
    e.preventDefault();
    const encontrados = validarRegistro(form);
    setErrores(encontrados);
    setTocados(Object.fromEntries(Object.keys(INICIAL).map((k) => [k, true])));
    if (Object.keys(encontrados).length) {
      toast.error('Revisa los campos marcados.');
      return;
    }
    setEnviando(true);
    try {
      await registrar(form);
      toast.success('Tu cuenta quedó activa. ¡Bienvenida(o) a la Mesa de Ayuda!');
      // La sesión ya quedó iniciada en el servidor: se pasa a la mini-app del usuario
      window.location.assign('/usuario/tickets');
    } catch (ex) {
      if (ex.errores) setErrores(ex.errores);
      toast.error(ex.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="container-xl py-5">
      <div className="row g-4 justify-content-center">
        <div className="col-lg-7">
          <div className="card p-4">
            <h1 className="mb-1">Crear mi cuenta</h1>
            <p className="text-muted">Solo para miembros de la comunidad con correo institucional.</p>
            <form onSubmit={enviar} noValidate>
              <fieldset disabled={enviando}>
                <div className="row g-3">
                  <div className="col-md-6">
                    <FormField id="nombres" label="Nombres" error={err('nombres')} className="">
                      <input id="nombres" name="nombres" className={inputClass(err('nombres'))} value={form.nombres} onChange={cambiar} onBlur={salir} maxLength={60} />
                    </FormField>
                  </div>
                  <div className="col-md-6">
                    <FormField id="apellidos" label="Apellidos" error={err('apellidos')} className="">
                      <input id="apellidos" name="apellidos" className={inputClass(err('apellidos'))} value={form.apellidos} onChange={cambiar} onBlur={salir} maxLength={60} />
                    </FormField>
                  </div>
                  <div className="col-md-6">
                    <FormField id="email" label="Correo institucional" error={err('email')} valid={emailOk ? 'Correo válido y disponible.' : null} className="">
                      <input id="email" name="email" type="email" className={`${inputClass(err('email'))} ${emailOk ? 'is-valid' : ''}`} value={form.email} onChange={cambiar} onBlur={salir} placeholder="nombre@aloe.ulima.edu.pe" />
                    </FormField>
                  </div>
                  <div className="col-md-6">
                    <FormField id="telefono" label="Teléfono" error={err('telefono')} hint="Para coordinar el acceso al ambiente." className="">
                      <input id="telefono" name="telefono" className={inputClass(err('telefono'))} value={form.telefono} onChange={cambiar} onBlur={salir} placeholder="987 654 321" />
                    </FormField>
                  </div>
                  <div className="col-md-6">
                    <FormField id="password" label="Contraseña" error={err('password')} hint="Mínimo 8 caracteres, con una mayúscula y un número." className="">
                      <input id="password" name="password" type="password" autoComplete="new-password" className={inputClass(err('password'))} value={form.password} onChange={cambiar} onBlur={salir} />
                    </FormField>
                  </div>
                  <div className="col-md-6">
                    <FormField id="confirmar" label="Confirmar contraseña" error={err('confirmar')} className="">
                      <input id="confirmar" name="confirmar" type="password" autoComplete="new-password" className={inputClass(err('confirmar'))} value={form.confirmar} onChange={cambiar} onBlur={salir} />
                    </FormField>
                  </div>
                  <div className="col-md-6">
                    <FormField id="unidad" label="Unidad o carrera" error={err('unidad')} className="">
                      <select id="unidad" name="unidad" className={inputClass(err('unidad'), 'form-select')} value={form.unidad} onChange={cambiar} onBlur={salir}>
                        <option value="">Selecciona…</option>
                        {unidades.map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </FormField>
                  </div>
                  <div className="col-md-6">
                    <FormField id="vinculo" label="Vínculo con la universidad" error={err('vinculo')} className="">
                      <select id="vinculo" name="vinculo" className={inputClass(err('vinculo'), 'form-select')} value={form.vinculo} onChange={cambiar} onBlur={salir}>
                        <option value="">Selecciona…</option>
                        {VINCULOS.map((v) => <option key={v.codigo} value={v.codigo}>{v.nombre}</option>)}
                      </select>
                    </FormField>
                  </div>
                  <div className="col-12">
                    <div className="form-check">
                      <input id="terminos" name="terminos" type="checkbox" className={inputClass(err('terminos'), 'form-check-input')} checked={form.terminos} onChange={cambiar} onBlur={salir} />
                      <label className="form-check-label small" htmlFor="terminos">Acepto los términos del servicio y la política de privacidad.</label>
                      {err('terminos') && <div className="invalid-feedback d-block">{err('terminos')}</div>}
                    </div>
                  </div>
                </div>
                <div className="d-flex gap-2 mt-4">
                  <button type="submit" className="btn btn-primary">
                    {enviando && <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />}Crear cuenta
                  </button>
                  <a href="/" className="btn btn-outline-primary">Cancelar</a>
                </div>
              </fieldset>
            </form>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="card p-4">
            <h3>Antes de registrarte</h3>
            <p className="small text-muted">Si eres técnico o supervisor no uses este formulario: el área de Infraestructura te envía una invitación con tus datos precargados.</p>
            <p className="small text-muted mb-0">Tu cuenta queda activa al instante; el correo de bienvenida llega en pocos minutos.</p>
          </div>
          <p className="small text-center mt-3">¿Ya tienes cuenta? <a href="/login">Inicia sesión</a></p>
        </div>
      </div>
    </div>
  );
}

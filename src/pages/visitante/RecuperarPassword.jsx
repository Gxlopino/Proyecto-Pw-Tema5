// HU-1 · 1.5 Recuperar contraseña · Visitante (paso 1 correo, paso 2 enlace enviado, paso 3 nueva contraseña)
// src/pages/visitante/RecuperarPassword.jsx
import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';
import FormField, { inputClass } from '../../widgets/FormField';
import EmptyState from '../../widgets/EmptyState';
import { solicitarRecuperacion, validarTokenRecuperacion, restablecerPassword } from '../../services/auth.service';
import { fuerzaPassword } from '../../helpers/validation';

const ETIQUETA_FUERZA = ['Muy débil', 'Débil', 'Aceptable', 'Segura'];

function PasoNuevaPassword({ token }) {
  const [valido, setValido] = useState(null);
  const [form, setForm] = useState({ password: '', confirmar: '' });
  const [errores, setErrores] = useState({});
  const [enviando, setEnviando] = useState(false);
  const fuerza = fuerzaPassword(form.password);

  useEffect(() => { validarTokenRecuperacion(token).then(() => setValido(true)).catch(() => setValido(false)); }, [token]);

  const guardar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    try {
      await restablecerPassword(token, form.password, form.confirmar);
      toast.success('Contraseña actualizada. Ya puedes iniciar sesión.');
      window.location.assign('/login');
    } catch (ex) {
      if (ex.errores) setErrores(ex.errores);
      toast.error(ex.message);
    } finally {
      setEnviando(false);
    }
  };

  if (valido === null) return <div className="text-center py-4"><span className="spinner-border text-primary" /></div>;
  if (!valido) return <EmptyState title="El enlace no es válido" message="Puede haber vencido (dura 30 minutos) o ya fue usado. Solicita uno nuevo." action={<Link to="/recuperar" className="btn btn-primary">Solicitar otro enlace</Link>} />;

  return (
    <form onSubmit={guardar} noValidate>
      <div className="label-caps mb-2">Paso 3 · Nueva contraseña</div>
      <FormField id="password" label="Nueva contraseña" error={errores.password}>
        <input id="password" type="password" autoComplete="new-password" className={inputClass(errores.password)} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
      </FormField>
      <div className="d-flex align-items-center gap-2 mb-3" style={{ marginTop: -8 }}>
        <div className="strength flex-grow-1">
          {[1, 2, 3].map((n) => <span key={n} className={fuerza >= n ? `on-${fuerza}` : ''} />)}
        </div>
        <small className={fuerza === 3 ? 'text-success' : 'text-muted'}>{form.password ? ETIQUETA_FUERZA[fuerza] : ''}</small>
      </div>
      <FormField id="confirmar" label="Confirmar" error={errores.confirmar}>
        <input id="confirmar" type="password" autoComplete="new-password" className={inputClass(errores.confirmar)} value={form.confirmar} onChange={(e) => setForm({ ...form, confirmar: e.target.value })} />
      </FormField>
      <button type="submit" className="btn btn-primary w-100" disabled={enviando}>{enviando && <span className="spinner-border spinner-border-sm me-2" />}Guardar contraseña</button>
    </form>
  );
}

function PasoCorreo() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [espera, setEspera] = useState(0);

  useEffect(() => {
    if (!espera) return undefined;
    const id = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [espera]);

  const enviar = async (e) => {
    e?.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const r = await solicitarRecuperacion(email);
      setResultado(r);
      setEspera(45);
    } catch (ex) {
      setError(ex.errores?.email || ex.message);
    } finally {
      setEnviando(false);
    }
  };

  if (resultado) {
    return (
      <div>
        <div className="label-caps mb-2">Paso 2 · Enlace enviado</div>
        <span className="d-inline-flex align-items-center justify-content-center border border-success text-success rounded mb-2" style={{ width: 36, height: 36, background: '#E7F4EC' }}><FontAwesomeIcon icon={faCheck} /></span>
        <h2>Revisa tu correo</h2>
        <p className="text-muted">Si {resultado.email} tiene una cuenta, le enviamos el enlace. Vence en 30 minutos.</p>
        {resultado.enlace && (
          <div className="surface-soft small p-2 mb-3">
            Entrega 1 (sin envío real de correos): <Link to={resultado.enlace}>abrir el enlace de recuperación</Link>
          </div>
        )}
        <button type="button" className="btn btn-link p-0" disabled={espera > 0} onClick={enviar}>
          Reenviar enlace{espera > 0 ? ` (disponible en 0:${String(espera).padStart(2, '0')})` : ''}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} noValidate>
      <div className="label-caps mb-2">Paso 1 · Tu correo</div>
      <p className="text-muted">Escribe el correo con el que te registraste y te enviaremos un enlace para crear una nueva contraseña.</p>
      <FormField id="email" label="Correo institucional" error={error}>
        <input id="email" type="email" className={inputClass(error)} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@aloe.ulima.edu.pe" />
      </FormField>
      <button type="submit" className="btn btn-primary w-100" disabled={enviando}>{enviando && <span className="spinner-border spinner-border-sm me-2" />}Enviar enlace</button>
    </form>
  );
}

export default function RecuperarPassword() {
  const [params] = useSearchParams();
  const token = params.get('token');
  return (
    <div className="container-xl py-5">
      <div className="card p-4 mx-auto" style={{ maxWidth: 480 }}>
        <h1 className="mb-3">Recuperar contraseña</h1>
        {token ? <PasoNuevaPassword token={token} /> : <PasoCorreo />}
        <p className="small text-center mt-3 mb-0"><a href="/login">Volver a iniciar sesión</a></p>
      </div>
    </div>
  );
}

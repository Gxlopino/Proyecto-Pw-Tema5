// HU-1 · 1.4 Alta por invitación · Visitante (técnico o supervisor invitado)
// src/pages/visitante/AltaInvitacion.jsx
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import FormField, { inputClass } from '../../widgets/FormField';
import ConfirmDialog from '../../widgets/ConfirmDialog';
import EmptyState from '../../widgets/EmptyState';
import { obtenerInvitacion, aceptarInvitacion, rechazarInvitacion } from '../../services/auth.service';
import { categoriasSync } from '../../services/catalogo.service';
import { ROLES, rutaInicio } from '../../helpers/navigation';
import { formatFecha } from '../../helpers/datetime';

export default function AltaInvitacion() {
  const { token } = useParams();
  const [inv, setInv] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);
  const [form, setForm] = useState({ telefono: '', password: '', confirmar: '', especialidades: [] });
  const [errores, setErrores] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [confirmarRechazo, setConfirmarRechazo] = useState(false);
  const categorias = categoriasSync().filter((c) => c.parentId === null && c.activa);

  useEffect(() => {
    obtenerInvitacion(token)
      .then((data) => { setInv(data); setForm((f) => ({ ...f, telefono: data.telefono || '' })); })
      .catch((e) => setErrorCarga(e.message))
      .finally(() => setCargando(false));
  }, [token]);

  const cambiar = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const toggleEspecialidad = (id) => {
    setForm((f) => {
      const ya = f.especialidades.includes(id);
      if (!ya && f.especialidades.length >= 3) {
        toast.info('Puedes elegir hasta tres categorías.');
        return f;
      }
      return { ...f, especialidades: ya ? f.especialidades.filter((x) => x !== id) : [...f.especialidades, id] };
    });
  };

  const activar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    setErrores({});
    try {
      const u = await aceptarInvitacion(token, form);
      toast.success(`Cuenta de ${ROLES[u.rol].toLowerCase()} activada. ¡Bienvenida(o)!`);
      // La sesión ya quedó iniciada en el servidor: técnico → bandeja, supervisor → cola
      window.location.assign(rutaInicio(u.rol));
    } catch (ex) {
      if (ex.errores) setErrores(ex.errores);
      toast.error(ex.message);
    } finally {
      setEnviando(false);
    }
  };

  const rechazar = async () => {
    await rechazarInvitacion(token);
    setConfirmarRechazo(false);
    toast.info('Rechazaste la invitación. Puedes cerrar esta ventana.');
    setInv((i) => ({ ...i, estado: 'rechazada' }));
  };

  if (cargando) return <div className="container-xl py-5 text-center"><span className="spinner-border text-primary" /></div>;

  if (errorCarga || !inv) {
    return <div className="container-xl py-5"><div className="card"><EmptyState title="Invitación no encontrada" message="El enlace no existe o fue escrito mal. Pide una nueva invitación al área de Infraestructura." action={<a href="/" className="btn btn-primary">Ir al inicio</a>} /></div></div>;
  }
  if (inv.estado !== 'pendiente' || inv.vencida) {
    const msg = inv.estado === 'aceptada' ? 'Esta invitación ya fue usada. Inicia sesión con tu correo.'
      : inv.estado === 'rechazada' ? 'Esta invitación fue rechazada.'
        : `La invitación venció el ${formatFecha(inv.venceEn)}. Pide una nueva al área de Infraestructura.`;
    return <div className="container-xl py-5"><div className="card"><EmptyState title="Invitación no disponible" message={msg} action={<a href="/login" className="btn btn-primary">Iniciar sesión</a>} /></div></div>;
  }

  return (
    <div className="container-xl py-5">
      <div className="card p-4 mx-auto" style={{ maxWidth: 820 }}>
        <div className="text-center mb-3"><span className="filter-chip label-caps">Invitación válida hasta el {formatFecha(inv.venceEn)}</span></div>
        <h1 className="text-center mb-1">Activa tu cuenta de {ROLES[inv.rol].toLowerCase()}</h1>
        <p className="text-center text-muted">{inv.invitadoPor} te invitó a la Mesa de Ayuda. Revisa tus datos, define tu contraseña{inv.rol === 'tecnico' ? ' y elige tu especialidad' : ''}.</p>
        <form onSubmit={activar} noValidate>
          <fieldset disabled={enviando}>
            <div className="row g-3">
              <div className="col-md-6">
                <FormField id="nombre" label="Nombres y apellidos" hint="Dato de la invitación, no editable." className="">
                  <input id="nombre" className="form-control" value={`${inv.nombres} ${inv.apellidos}`} readOnly disabled />
                </FormField>
              </div>
              <div className="col-md-6">
                <FormField id="correo" label="Correo institucional" className="">
                  <input id="correo" className="form-control" value={inv.email} readOnly disabled />
                </FormField>
              </div>
              <div className="col-md-6">
                <FormField id="rol" label="Rol asignado" className="">
                  <input id="rol" className="form-control" value={ROLES[inv.rol]} readOnly disabled />
                </FormField>
              </div>
              <div className="col-md-6">
                <FormField id="telefono" label="Teléfono de contacto" error={errores.telefono} className="">
                  <input id="telefono" name="telefono" className={inputClass(errores.telefono)} value={form.telefono} onChange={cambiar} />
                </FormField>
              </div>
              <div className="col-md-6">
                <FormField id="password" label="Contraseña" error={errores.password} hint="Mínimo 8 caracteres, con una mayúscula y un número." className="">
                  <input id="password" name="password" type="password" autoComplete="new-password" className={inputClass(errores.password)} value={form.password} onChange={cambiar} />
                </FormField>
              </div>
              <div className="col-md-6">
                <FormField id="confirmar" label="Confirmar contraseña" error={errores.confirmar} className="">
                  <input id="confirmar" name="confirmar" type="password" autoComplete="new-password" className={inputClass(errores.confirmar)} value={form.confirmar} onChange={cambiar} />
                </FormField>
              </div>
              {inv.rol === 'tecnico' && (
                <div className="col-12">
                  <div className="form-label">Especialidad · elige hasta tres categorías</div>
                  <div className="d-flex flex-wrap gap-2">
                    {categorias.map((c) => {
                      const activa = form.especialidades.includes(c.id);
                      return (
                        <button type="button" key={c.id} className={`btn btn-sm ${activa ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => toggleEspecialidad(c.id)} aria-pressed={activa}>
                          {c.nombre}{activa ? ' ✓' : ''}
                        </button>
                      );
                    })}
                  </div>
                  {errores.especialidades && <div className="invalid-feedback d-block">{errores.especialidades}</div>}
                </div>
              )}
            </div>
            <div className="d-flex gap-2 mt-4">
              <button type="submit" className="btn btn-primary">{enviando && <span className="spinner-border spinner-border-sm me-2" />}Activar mi cuenta</button>
              <button type="button" className="btn btn-outline-primary" onClick={() => setConfirmarRechazo(true)}>Rechazar invitación</button>
            </div>
          </fieldset>
        </form>
      </div>
      <ConfirmDialog
        show={confirmarRechazo}
        title="¿Rechazar la invitación?"
        message="No podrás usar este enlace otra vez. Si cambias de opinión tendrán que enviarte una nueva invitación."
        confirmLabel="Rechazar invitación"
        onConfirm={rechazar}
        onCancel={() => setConfirmarRechazo(false)}
      />
    </div>
  );
}

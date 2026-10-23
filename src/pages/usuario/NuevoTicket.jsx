// HU-3 · 3.1 Nuevo ticket · Usuario (incluye el aviso de ticket duplicado)
// src/pages/usuario/NuevoTicket.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import FormField, { inputClass } from '../../widgets/FormField';
import { LISTA_PRIORIDADES, nombrePrioridad } from '../../widgets/Badges';
import { useAuth } from '../../context/AuthContext';
import { categoriasSync, ambientesSync, horasPorPrioridad, nombreTipoAmbiente } from '../../services/catalogo.service';
import { crearTicket, buscarDuplicado, validarTicket, MAX_DESCRIPCION } from '../../services/tickets.service';
import { haceCuanto } from '../../helpers/datetime';

export default function NuevoTicket() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const categorias = useMemo(() => categoriasSync(), []);
  const ambientes = useMemo(() => ambientesSync().filter((a) => a.activo !== false), []);
  const padres = categorias.filter((c) => c.parentId === null && c.activa);
  const [form, setForm] = useState({
    categoriaId: '', subcategoriaId: '', ambienteId: usuario.ambienteHabitualId || '', prioridadSugerida: '', asunto: '', descripcion: '',
  });
  const [errores, setErrores] = useState({});
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [duplicado, setDuplicado] = useState(null);

  const subs = categorias.filter((c) => c.parentId === Number(form.categoriaId) && c.activa);
  const sub = categorias.find((c) => c.id === Number(form.subcategoriaId));
  const ambiente = ambientes.find((a) => a.id === Number(form.ambienteId));
  const horas = sub ? (form.prioridadSugerida === sub.prioridadDefecto ? sub.tiempoEsperadoHoras : horasPorPrioridad(form.prioridadSugerida)) : null;

  useEffect(() => {
    let vigente = true;
    buscarDuplicado(form.ambienteId, form.categoriaId).then((d) => { if (vigente) setDuplicado(d); });
    return () => { vigente = false; };
  }, [form.ambienteId, form.categoriaId]);

  const actualizar = (datos) => {
    setForm(datos);
    if (enviado) setErrores(validarTicket(datos));
  };

  const cambiar = (e) => {
    const { name, value } = e.target;
    const datos = { ...form, [name]: value };
    if (name === 'categoriaId') { datos.subcategoriaId = ''; datos.prioridadSugerida = ''; }
    if (name === 'subcategoriaId') {
      const s = categorias.find((c) => c.id === Number(value));
      datos.prioridadSugerida = s?.prioridadDefecto || '';
      if (!form.asunto && s && ambiente) datos.asunto = `${s.nombre} en ${ambiente.codigo}`;
    }
    actualizar(datos);
  };

  const enviar = async (e) => {
    e.preventDefault();
    setEnviado(true);
    const encontrados = validarTicket(form);
    setErrores(encontrados);
    if (Object.keys(encontrados).length) {
      toast.error('Revisa los campos marcados.');
      return;
    }
    setEnviando(true);
    try {
      const t = await crearTicket(form, usuario.id);
      toast.success(`Ticket ${t.codigo} registrado.`);
      navigate(`/usuario/tickets/${t.codigo}/confirmacion`, { replace: true });
    } catch (ex) {
      if (ex.errores) setErrores(ex.errores);
      toast.error(ex.status ? ex.message : 'No pudimos registrar el ticket. Revisa tu conexión e inténtalo otra vez.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <h1 className="mb-1">Registrar un ticket</h1>
      <p className="text-muted">Indica qué falla y dónde. La prioridad se sugiere según la categoría y el supervisor puede ajustarla.</p>

      {duplicado && (
        <div className="alert alert-warning d-flex flex-wrap align-items-center gap-2" role="alert">
          <span>
            Ya existe un ticket abierto para <strong>{duplicado.ambiente}</strong> en <strong>{duplicado.categoria}</strong>:{' '}
            <span className="font-mono">{duplicado.codigo}</span>, registrado hace {haceCuanto(duplicado.creadoEn)}. Revísalo antes de crear otro.
          </span>
          {duplicado.solicitanteId === usuario.id && <Link to={`/usuario/tickets/${duplicado.codigo}`} className="btn btn-sm btn-outline-primary ms-auto">Ver ese ticket</Link>}
        </div>
      )}

      <div className="row g-3">
        <div className="col-lg-8">
          <form className="card p-4" onSubmit={enviar} noValidate>
            <fieldset disabled={enviando}>
              <div className="row g-3">
                <div className="col-md-6">
                  <FormField id="categoriaId" label="Categoría" error={errores.categoriaId} className="">
                    <select id="categoriaId" name="categoriaId" className={inputClass(errores.categoriaId, 'form-select')} value={form.categoriaId} onChange={cambiar}>
                      <option value="">Selecciona…</option>
                      {padres.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </FormField>
                </div>
                <div className="col-md-6">
                  <FormField id="subcategoriaId" label="Subcategoría" error={errores.subcategoriaId} hint={sub?.descripcion || 'Depende de la categoría elegida.'} className="">
                    <select id="subcategoriaId" name="subcategoriaId" className={inputClass(errores.subcategoriaId, 'form-select')} value={form.subcategoriaId} onChange={cambiar} disabled={!form.categoriaId}>
                      <option value="">Selecciona…</option>
                      {subs.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </FormField>
                </div>
                <div className="col-md-6">
                  <FormField id="ambienteId" label="Ambiente" error={errores.ambienteId} hint={ambiente ? `${nombreTipoAmbiente(ambiente.tipo)} · Pabellón ${ambiente.pabellon} · piso ${ambiente.piso}` : 'El código que aparece en la puerta.'} className="">
                    <select id="ambienteId" name="ambienteId" className={inputClass(errores.ambienteId, 'form-select')} value={form.ambienteId} onChange={cambiar}>
                      <option value="">Selecciona…</option>
                      {ambientes.map((a) => <option key={a.id} value={a.id}>{a.codigo} · {a.nombre}</option>)}
                    </select>
                  </FormField>
                </div>
                <div className="col-md-6">
                  <FormField id="prioridadSugerida" label="Prioridad sugerida" error={errores.prioridadSugerida} hint={sub ? `Sugerida por la subcategoría: ${nombrePrioridad(sub.prioridadDefecto)}` : null} className="">
                    <select id="prioridadSugerida" name="prioridadSugerida" className={inputClass(errores.prioridadSugerida, 'form-select')} value={form.prioridadSugerida} onChange={cambiar}>
                      <option value="">Selecciona…</option>
                      {LISTA_PRIORIDADES.map((p) => <option key={p.codigo} value={p.codigo}>{p.nombre}</option>)}
                    </select>
                  </FormField>
                </div>
                <div className="col-12">
                  <FormField id="asunto" label="Asunto" error={errores.asunto} className="">
                    <input id="asunto" name="asunto" className={inputClass(errores.asunto)} value={form.asunto} onChange={cambiar} maxLength={100} placeholder="Proyector no enciende en aula A-201" />
                  </FormField>
                </div>
                <div className="col-12">
                  <FormField id="descripcion" label="Descripción" error={errores.descripcion} hint={`Indica qué probaste y desde cuándo ocurre. ${form.descripcion.length} / ${MAX_DESCRIPCION}`} className="">
                    <textarea id="descripcion" name="descripcion" rows={4} className={inputClass(errores.descripcion)} value={form.descripcion} onChange={cambiar} maxLength={MAX_DESCRIPCION} />
                  </FormField>
                </div>
                <div className="col-12">
                  <div className="form-label">Evidencia (opcional)</div>
                  <div className="border rounded p-3 text-center small text-muted" style={{ borderStyle: 'dashed', background: 'var(--color-bg)' }}>
                    La carga de fotos no está incluida en el alcance del sistema. Describe la falla con el mayor detalle posible.
                  </div>
                </div>
              </div>
              <div className="d-flex gap-2 mt-4">
                <button type="submit" className="btn btn-primary">{enviando && <span className="spinner-border spinner-border-sm me-2" />}Registrar ticket</button>
                <Link to="/usuario/tickets" className="btn btn-outline-primary">Cancelar</Link>
              </div>
            </fieldset>
          </form>
        </div>
        <div className="col-lg-4">
          <div className="card p-4 mb-3">
            <h3>Qué conviene incluir</h3>
            <ul className="small text-muted ps-3 mb-0">
              <li>El código del ambiente tal como aparece en la puerta.</li>
              <li>Desde cuándo ocurre la falla y si es intermitente.</li>
              <li>Qué ya intentaste (cambiar cable, reiniciar equipo).</li>
              <li>Si hay clase o evento en las próximas horas.</li>
              <li>Un teléfono de contacto si hay que coordinar el acceso.</li>
            </ul>
          </div>
          <div className="surface-soft p-3">
            <div className="fw-semibold small mb-1">Tiempo esperado para esta categoría</div>
            <div className="small">
              {horas ? `Prioridad ${nombrePrioridad(form.prioridadSugerida).toLowerCase()}: atención dentro de ${horas} horas hábiles desde el registro.` : 'Elige la subcategoría para ver el tiempo de atención esperado.'}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

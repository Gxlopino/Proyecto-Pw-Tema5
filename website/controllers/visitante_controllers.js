// website/controllers/visitante_controllers.js
import * as service from '../services/cuenta_services.js';
import { rutaInicio } from '../../configs/helpers.js';

// HU-1 · 1.1 Landing pública · Visitante
export function home(req, res) {
  return res.render('visitante/home', {
    title: 'Mesa de Ayuda · Campus Ulima',
    currentPage: 'home',
    categorias: service.categoriasLanding(),
    prioridades: service.prioridadesLanding(),
  });
}

// HU-1 · 1.2 Inicio de sesión · Visitante
export function login(req, res) {
  return res.render('visitante/login', {
    title: 'Iniciar sesión · Mesa de Ayuda',
    mensaje: null,
    email: '',
  });
}

export function ingresar(req, res) {
  const { email, password, recordar } = req.body;
  try {
    const usuario = service.login(email, password);
    req.session.userId = usuario.id;
    req.session.username = usuario.email;
    req.session.role = usuario.rol;
    // Sin "Recordarme" la sesión termina al cerrar el navegador (con él dura 24 h)
    if (!recordar) req.session.cookie.expires = false;
    req.session.save(() => res.redirect(rutaInicio(usuario.rol)));
  } catch (error) {
    let mensaje = error.message;
    if (error.restantes > 0) {
      mensaje = `Correo o contraseña incorrectos. Te quedan ${error.restantes} intentos antes del bloqueo temporal.`;
    }
    if (error.bloqueadoHasta) {
      const hora = new Date(error.bloqueadoHasta).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Lima' });
      mensaje = `Cuenta bloqueada por 15 minutos tras cinco intentos fallidos. Podrás ingresar a las ${hora} o restablecer tu contraseña ahora.`;
    }
    return res.status(error.status || 400).render('visitante/login', {
      title: 'Iniciar sesión · Mesa de Ayuda',
      mensaje,
      bloqueado: !!error.bloqueadoHasta,
      credenciales: error.status === 401,
      email: email || '',
    });
  }
}

export function logout(req, res) {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.redirect('/login');
  });
}

// HU-1 · 1.3 Registro, 1.4 Alta por invitación y 1.5 Recuperar contraseña (mini-app React del visitante)
export function cuenta(req, res) {
  return res.render('visitante/cuenta', {
    title: 'Mesa de Ayuda · Campus Ulima',
    app: 'visitante',
  });
}

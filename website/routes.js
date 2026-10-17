// website/configs/routes.js
import { Router } from 'express';
import * as cuentaApis from '../apis/cuenta_apis.js';
import * as visitantes from '../controllers/visitante_controllers.js';
import { soloLogueado, soloSupervisor, redireccionarSiLogueado } from '../../configs/middlewares.js';

const router = Router();

// ejs views · visitante
router.get('/', visitantes.home);
router.get('/login', redireccionarSiLogueado, visitantes.login);
router.post('/login', visitantes.ingresar);
router.get('/logout', visitantes.logout);

// react views · visitante (mini-app visitante.js; una línea por ruta de React Router para que F5 funcione)
router.get('/registro', redireccionarSiLogueado, visitantes.cuenta);
router.get('/recuperar', visitantes.cuenta);
router.get('/invitacion/:token', visitantes.cuenta);

// api sesión y cuenta (HU-1)
router.get('/api/v1/sessions', soloLogueado, cuentaApis.sessionInfo);
router.get('/api/v1/unidades', cuentaApis.listarUnidades);
router.get('/api/v1/registro/disponible', cuentaApis.emailDisponible);
router.post('/api/v1/registro', cuentaApis.registrar);
router.get('/api/v1/invitaciones/:token', cuentaApis.obtenerInvitacion);
router.post('/api/v1/invitaciones/:token/aceptar', cuentaApis.aceptarInvitacion);
router.post('/api/v1/invitaciones/:token/rechazar', cuentaApis.rechazarInvitacion);
router.post('/api/v1/invitaciones', soloSupervisor, cuentaApis.crearInvitacion);
router.post('/api/v1/recuperar', cuentaApis.solicitarRecuperacion);
router.get('/api/v1/recuperar/:token', cuentaApis.validarTokenRecuperacion);
router.post('/api/v1/restablecer', cuentaApis.restablecerPassword);
router.put('/api/v1/cuenta', soloLogueado, cuentaApis.actualizarCuenta);
router.put('/api/v1/cuenta/password', soloLogueado, cuentaApis.cambiarPassword);

export default router;
// admin/configs/routes.js
import { Router } from 'express';
import * as usuarios from '../controllers/usuario_controllers.js';
import * as tecnicos from '../controllers/tecnico_controllers.js';
import * as supervisores from '../controllers/supervisor_controllers.js';
import * as nationApis from '../apis/nations_apis.js';
import { soloLogueado, soloUsuario, soloTecnico, soloSupervisor } from '../../configs/middlewares.js';

const router = Router();

// react views · usuario (una línea por ruta de React Router para que F5 funcione)
router.get('/usuario', soloLogueado, soloUsuario, usuarios.home);
router.get('/usuario/tickets', soloLogueado, soloUsuario, usuarios.home);
router.get('/usuario/tickets/nuevo', soloLogueado, soloUsuario, usuarios.home);
router.get('/usuario/tickets/:codigo', soloLogueado, soloUsuario, usuarios.home);
router.get('/usuario/tickets/:codigo/confirmacion', soloLogueado, soloUsuario, usuarios.home);
router.get('/usuario/mi-cuenta', soloLogueado, soloUsuario, usuarios.home);

// react views · técnico
router.get('/tecnico', soloLogueado, soloTecnico, tecnicos.home);
router.get('/tecnico/bandeja', soloLogueado, soloTecnico, tecnicos.home);
router.get('/tecnico/tickets/:codigo', soloLogueado, soloTecnico, tecnicos.home);
router.get('/tecnico/tickets/:codigo/historial', soloLogueado, soloTecnico, tecnicos.home);
router.get('/tecnico/mi-cuenta', soloLogueado, soloTecnico, tecnicos.home);

// react views · supervisor
router.get('/supervisor', soloLogueado, soloSupervisor, supervisores.home);
router.get('/supervisor/cola', soloLogueado, soloSupervisor, supervisores.home);
router.get('/supervisor/bandejas', soloLogueado, soloSupervisor, supervisores.home);
router.get('/supervisor/categorias', soloLogueado, soloSupervisor, supervisores.home);
router.get('/supervisor/categorias/nueva', soloLogueado, soloSupervisor, supervisores.home);
router.get('/supervisor/categorias/:id', soloLogueado, soloSupervisor, supervisores.home);
router.get('/supervisor/ambientes', soloLogueado, soloSupervisor, supervisores.home);
router.get('/supervisor/tecnicos-categoria', soloLogueado, soloSupervisor, supervisores.home);
router.get('/supervisor/tickets/:codigo', soloLogueado, soloSupervisor, supervisores.home);
router.get('/supervisor/tickets/:codigo/historial', soloLogueado, soloSupervisor, supervisores.home);
router.get('/supervisor/mi-cuenta', soloLogueado, soloSupervisor, supervisores.home);

// api nations (ejemplo del profesor para la Entrega 2)
router.get('/api/v1/nations', nationApis.listNations);
router.get('/api/v1/nations/:id', nationApis.getNationById);
router.post('/api/v1/nations', nationApis.createNation);
router.put('/api/v1/nations/:id', nationApis.updateNation);
router.delete('/api/v1/nations/:id', nationApis.deleteNation);

export default router;

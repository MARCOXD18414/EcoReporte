import { Router } from 'express';
import { autenticacionOpcional, requiereAuth } from '../middleware/auth.js';
import { ah } from './reportesRoutes.js';
import { crearBrigada, getFeed, listarBrigadas, unirseBrigada } from '../controllers/comunidadController.js';

const router = Router();

router.get('/feed', ah(getFeed));
router.get('/brigadas', autenticacionOpcional, ah(listarBrigadas));
router.post('/brigadas', requiereAuth, ah(crearBrigada));
router.post('/brigadas/:id/unirse', requiereAuth, ah(unirseBrigada));

export default router;

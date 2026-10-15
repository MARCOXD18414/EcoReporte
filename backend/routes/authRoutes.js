import { Router } from 'express';
import { ah } from './reportesRoutes.js';
import { loginAdmin, loginCiudadano } from '../controllers/authController.js';

const router = Router();

router.post('/ciudadano', ah(loginCiudadano));
router.post('/admin', ah(loginAdmin));

export default router;

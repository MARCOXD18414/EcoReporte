import { Router } from 'express';
import { requiereAdmin } from '../middleware/auth.js';
import { ah } from './reportesRoutes.js';
import { listarReportes } from '../controllers/reportesController.js';
import { actualizarEstado, getKpis, getNotificaciones, marcarNotificacionLeida } from '../controllers/dashboardController.js';

const router = Router();
router.use(requiereAdmin);

router.get('/kpis', ah(getKpis));
router.get('/reportes', ah(listarReportes));
router.patch('/reportes/:id/estado', ah(actualizarEstado));
router.get('/notificaciones', ah(getNotificaciones));
router.patch('/notificaciones/:id/leida', ah(marcarNotificacionLeida));

export default router;

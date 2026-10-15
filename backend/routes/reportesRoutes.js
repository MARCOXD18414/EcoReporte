import { Router } from 'express';
import multer from 'multer';
import { autenticacionOpcional } from '../middleware/auth.js';
import { analizarImagen, crearReporte, getCatalogos, listarReportes, obtenerReporte } from '../controllers/reportesController.js';

// Express 4 no captura errores async por sí solo
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    /^image\/(jpeg|png|webp|heic|heif)$/.test(file.mimetype)
      ? cb(null, true)
      : cb(Object.assign(new Error('Formato de imagen no soportado'), { status: 415 })),
});

const router = Router();

router.get('/catalogos', ah(getCatalogos));
router.post('/analizar', upload.single('imagen'), ah(analizarImagen));
router.get('/', ah(listarReportes));
router.post('/', autenticacionOpcional, upload.single('imagen'), ah(crearReporte));
router.get('/:id', ah(obtenerReporte));

export default router;

import express from 'express';
import authenticate from '../../../shared/middlewares/authenticate.js';
import syntheticsContainer from '../Dependencies/dependencies.js';

const router = express.Router();
const controller = syntheticsContainer.controllers.syntheticController;
router.use(authenticate);
router.get('/', (req, res, next) => controller.list(req, res, next));
router.post('/', (req, res, next) => controller.create(req, res, next));
router.post('/trigger-all', (req, res, next) => controller.triggerAll(req, res, next));
router.delete('/:id', (req, res, next) => controller.remove(req, res, next));
router.get('/:id/runs', (req, res, next) => controller.runs(req, res, next));
export default router;
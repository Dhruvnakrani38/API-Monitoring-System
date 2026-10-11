import express from 'express';
import authenticate from '../../../shared/middlewares/authenticate.js';
import syntheticsContainer from '../Dependencies/dependencies.js';

const router = express.Router();
const { journeyController } = syntheticsContainer.controllers;

router.use(authenticate);

// GET  /api/journeys                     — List all journeys for this client
router.get('/', (req, res, next) => journeyController.list(req, res, next));

// POST /api/journeys                     — Create a new multi-step journey
router.post('/', (req, res, next) => journeyController.create(req, res, next));

// GET  /api/journeys/:id                 — Get journey + steps detail
router.get('/:id', (req, res, next) => journeyController.getById(req, res, next));

// DELETE /api/journeys/:id              — Delete a journey
router.delete('/:id', (req, res, next) => journeyController.remove(req, res, next));

// GET  /api/journeys/:id/runs           — Fetch run history for a journey
router.get('/:id/runs', (req, res, next) => journeyController.runs(req, res, next));

// POST /api/journeys/:id/run            — Manually trigger an immediate journey run
router.post('/:id/run', (req, res, next) => journeyController.triggerRun(req, res, next));

export default router;

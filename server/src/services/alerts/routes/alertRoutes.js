import express from 'express';
import authenticate from '../../../shared/middlewares/authenticate.js';
import alertsContainer from '../Dependencies/dependencies.js';

const router = express.Router();
const { alertController } = alertsContainer.controllers;

router.use(authenticate);
router.get('/rules', (req, res, next) => alertController.listRules(req, res, next));
router.post('/rules', (req, res, next) => alertController.createRule(req, res, next));
router.patch('/rules/:id', (req, res, next) => alertController.updateRule(req, res, next));
router.delete('/rules/:id', (req, res, next) => alertController.deleteRule(req, res, next));
router.get('/incidents', (req, res, next) => alertController.listIncidents(req, res, next));

export default router;
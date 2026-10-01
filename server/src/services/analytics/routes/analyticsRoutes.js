// =====================================================================
// analyticsRoutes.js
// Kaam: Analytics module ke routes define karte hain.
// /stats  => Overall statistics fetch karna
// /dashboard => Dashboard ke liye combined data fetch karna
// Dono routes pe authenticate middleware lagaya hai (JWT required).
// Reusability: server.js me /api/analytics prefix ke saath mount hota hai.
// =====================================================================

import express from 'express';
import analyticsContainer from '../Dependencies/dependencies.js';

// DI container se analyticsController nikaalo
const { analyticsController } = analyticsContainer.controllers;

// JWT authentication middleware - har request me authToken cookie check karega
import authenticate from '../../../shared/middlewares/authenticate.js';

const router = express.Router();

// GET /api/analytics/stats
// Logged-in user ke liye overall API stats fetch karta hai
// Super admin query param me clientId de sakta hai
router.get("/stats", authenticate, (req, res, next) => analyticsController.getStats(req, res, next));

// GET /api/analytics/dashboard
// Stats + TopEndpoints + TimeSeries - ek hi call me teen cheezein (parallel)
// Frontend Overview page issi se data lata hai
router.get("/dashboard", authenticate, (req, res, next) => analyticsController.getDashboard(req, res, next))
router.get("/endpoint-details", authenticate, (req, res, next) => analyticsController.getEndpointDetails(req, res, next));

export default router
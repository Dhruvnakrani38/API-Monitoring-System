// =====================================================================
// authRouter.js
// Kaam: Auth module ke saare HTTP routes define karte hain.
// Includes: SuperAdmin onboarding, Public signup, Admin registration,
//           Login, Profile, Logout, aur Admin approval/rejection routes.
// Reusability: server.js me /api/auth prefix ke saath mount hota hai.
// =====================================================================

import express from "express";
import dependencies from "../Dependencies/dependencies.js"
import authorize from "../../../shared/middlewares/authorize.js"
import authenticate from "../../../shared/middlewares/authenticate.js"
import validate from "../../../shared/middlewares/validate.js";
import requestLogger from "../../../shared/middlewares/requestLogger.js";
import { onboardSuperAdminSchema, loginSchema, registrationSchema } from "../validation/authSchema.js";
import { APPLICATION_ROLES } from "../../../shared/constants/roles.js";

const router = express.Router();
const { controller } = dependencies;
const authController = controller.authController

// -----------------------------------------------------------------------
// POST /api/auth/onboard-super-admin
// Pehla admin banana - koi authentication required nahi (sirf ek baar use karo!)
// validate: username, email, password required check
// -----------------------------------------------------------------------
router.post("/onboard-super-admin",
    requestLogger,                          // Request ki timing log karo
    validate(onboardSuperAdminSchema),      // Input validation
    (req, res, next) => authController.onboardSuperAdmin(req, res, next)
)

// -----------------------------------------------------------------------
// POST /api/auth/signup
// Public signup - koi bhi register kar sakta hai.
// Account 'pending' state me banega, admin approval ke baad active hoga.
// Frontend Signup.jsx yahi use karta hai.
// -----------------------------------------------------------------------
router.post("/signup",
    requestLogger,
    validate(registrationSchema),           // username, email, password validate karo
    (req, res, next) => authController.publicSignup(req, res, next)
)

// -----------------------------------------------------------------------
// POST /api/auth/register
// Admin ke through directly user banana (approval nahi chahiye).
// authenticate: JWT token required
// authorize: sirf SUPER_ADMIN yeh kar sakta hai
// -----------------------------------------------------------------------
router.post("/register",
    requestLogger,
    authenticate,                           // JWT check
    authorize([APPLICATION_ROLES.SUPER_ADMIN]), // SUPER_ADMIN only
    validate(registrationSchema),
    (req, res, next) => authController.register(req, res, next)
)

// -----------------------------------------------------------------------
// POST /api/auth/login
// Username + Password se login karna.
// Successful login pe httpOnly cookie me JWT set hoti hai.
// -----------------------------------------------------------------------
router.post("/login",
    requestLogger,
    validate(loginSchema),                  // username aur password required
    (req, res, next) => authController.login(req, res, next)
);

// -----------------------------------------------------------------------
// GET /api/auth/profile
// Logged-in user ki profile fetch karna.
// authenticate: JWT required (cookie se)
// -----------------------------------------------------------------------
router.get("/profile",
    requestLogger,
    authenticate,
    (req, res, next) => authController.getProfile(req, res, next)
)

// -----------------------------------------------------------------------
// GET /api/auth/logout
// Cookie clear karo - user logout ho jaata hai.
// -----------------------------------------------------------------------
router.get("/logout",
    requestLogger,
    (req, res, next) => authController.logout(req, res, next)
)

// -----------------------------------------------------------------------
// ADMIN APPROVAL ROUTES (SUPER_ADMIN only)
// -----------------------------------------------------------------------

// GET /api/auth/admin/pending-users
// Saare pending approval requests ki list
// PendingApprovalsPage.jsx yahi use karta hai
router.get("/admin/pending-users",
    requestLogger,
    authenticate,
    authorize([APPLICATION_ROLES.SUPER_ADMIN]),
    (req, res, next) => authController.getPendingUsers(req, res, next)
)

// POST /api/auth/admin/users/:userId/approve
// User ko approve karo - client aur API key automatically banega
router.post("/admin/users/:userId/approve",
    requestLogger,
    authenticate,
    authorize([APPLICATION_ROLES.SUPER_ADMIN]),
    (req, res, next) => authController.approveUser(req, res, next)
)

// POST /api/auth/admin/users/:userId/reject
// User ko reject karo - Body: { reason }
router.post("/admin/users/:userId/reject",
    requestLogger,
    authenticate,
    authorize([APPLICATION_ROLES.SUPER_ADMIN]),
    (req, res, next) => authController.rejectUser(req, res, next)
)

export default router
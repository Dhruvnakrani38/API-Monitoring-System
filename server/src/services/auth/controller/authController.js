// =====================================================================
// authController.js
// Kaam: Authentication aur user management ke saare HTTP endpoints yahan handle hote hain.
// Includes: SuperAdmin onboarding, Public signup, Admin registration, Login, Profile, Logout,
//           aur Admin approval/rejection workflows.
// Reusability: authRouter.js me use hota hai. authService se business logic milti hai.
// =====================================================================

import config from "../../../shared/config/index.js";
import { APPLICATION_ROLES } from "../../../shared/constants/roles.js";
import ResponseFormatter from "../../../shared/utils/responseFormatter.js"

/**
 * AuthController: Authentication se related saare request handle karta hai.
 * authService se actual business logic karvata hai aur
 * ResponseFormatter se consistent API response format deta hai.
 */
export class AuthController {
    // Constructor: authService aur clientService inject hote hain (DI pattern).
    // clientService approveUser me use hoti hai - client aur API key banane ke liye.
    constructor(authService, clientService) {
        if (!authService) {
            throw new Error("authService is Required");
        }

        this.authService = authService
        this.clientService = clientService
    };

    /**
     * onboardSuperAdmin: Pehli baar super admin banana ke liye.
     * POST /api/auth/onboard-super-admin
     * Body: { username, email, password }
     * JWT token cookie me set hota hai (httpOnly).
     */
    async onboardSuperAdmin(req, res, next) {
        try {
            const { username, email, password } = req.body;

            // Super admin role hardcode hai - koi user change nahi kar sakta
            const superAdminData = {
                username, email, password, role: APPLICATION_ROLES.SUPER_ADMIN
            };

            const { token, user } = await this.authService.onboardSuperAdmin(superAdminData);

            // JWT token httpOnly cookie me set karo (browser JS access nahi kar sakta - secure)
            res.cookie("authToken", token, {
                httpOnly: config.cookie.httpOnly,
                secure: config.cookie.secure,
                maxAge: config.cookie.expiresIn
            });

            res.status(201).json(ResponseFormatter.success(user, "Super admin created successfully", 201))
        } catch (error) {
            next(error)
        }
    };

    /**
     * publicSignup: Koi bhi naya user yahan sign up kar sakta hai.
     * POST /api/auth/signup (No authentication required)
     * Account 'pending' state me banta hai - admin approval ke baad active hoga.
     * Reusability: Frontend Signup.jsx yahi call karta hai.
     */
    async publicSignup(req, res, next) {
        try {
            const { username, email, password } = req.body;
            const userData = {
                username, email, password
                // Note: role nahi bheja - default 'client_viewer' aur approvalStatus 'pending' hoga
            };

            const { user, message } = await this.authService.publicSignup(userData);

            // 201 Created - account bana, lekin abhi active nahi hai
            res.status(201).json(ResponseFormatter.success(user, message, 201))
        } catch (error) {
            next(error)
        }
    }

    /**
     * register: Admin ke through directly user banana (approval skip).
     * POST /api/auth/register (authenticate + authorize SUPER_ADMIN required)
     * Admin sirf internal users ke liye yeh use kare.
     */
    async register(req, res, next) {
        try {
            const { username, email, password, role } = req.body;
            const userData = {
                username, email, password, role: role || APPLICATION_ROLES.CLIENT_VIEWER
            };

            const { token, user } = await this.authService.register(userData);

            // JWT cookie set karo
            res.cookie("authToken", token, {
                httpOnly: config.cookie.httpOnly,
                secure: config.cookie.secure,
                maxAge: config.cookie.expiresIn
            });

            res.status(201).json(ResponseFormatter.success(user, "User created successfully", 201))
        } catch (error) {
            next(error)
        }
    };

    /**
     * login: Username + Password se login karna.
     * POST /api/auth/login
     * JWT token cookie me set hota hai. Frontend page refresh pe bhi logged-in rahega.
     * Reusability: Login.jsx yahi API call karta hai.
     */
    async login(req, res, next) {
        try {
            const { username, password } = req.body;
            const { user, token } = await this.authService.login(username, password);

            // JWT cookie me store karo (frontend ko manually handle nahi karna)
            res.cookie("authToken", token, {
                httpOnly: config.cookie.httpOnly,
                secure: config.cookie.secure,
                maxAge: config.cookie.expiresIn
            });

            res.status(200).json(ResponseFormatter.success(user, "User LoggedIn successfully", 200))
        } catch (error) {
            next(error)
        }
    };

    /**
     * getProfile: Logged-in user ka profile fetch karna.
     * GET /api/auth/profile (authenticate required)
     * JWT se userId extract hota hai, phir DB se profile milti hai.
     */
    async getProfile(req, res, next) {
        try {
            const userId = req.user.userId;
            const result = await this.authService.getProfile(userId);

            if (result.clientId) {
                result.client = await this.clientService.getClientProfile(result.clientId);
            }

            if (result.approvedBy) {
                const approver = await this.authService.getProfile(result.approvedBy);
                result.approvedByUser = {
                    username: approver.username,
                    email: approver.email,
                    role: approver.role,
                };
            }

            res.status(200).json(ResponseFormatter.success(result, "Profile fetched successfully", 200))
        } catch (error) {
            next(error)
        }
    }

    /**
     * logout: User ko logout karna - cookie clear karo.
     * GET /api/auth/logout
     * Server side pe sirf cookie delete hoti hai (JWT stateless hai).
     */
    async logout(req, res, next) {
        try {
            res.clearCookie("authToken")
            res.status(200).json(ResponseFormatter.success({}, "Logout successful", 200))
        } catch (error) {
            next(error)
        }
    }

    /**
     * approveUser: Pending user ko approve karna.
     * POST /api/auth/admin/users/:userId/approve (SUPER_ADMIN only)
     * Approve hone pe automatically:
     *   1. User ka status 'approved' + isActive = true hota hai
     *   2. Client record create hota hai
     *   3. API key generate hoti hai
     * Reusability: PendingApprovalsPage.jsx se call hota hai.
     */
    async approveUser(req, res, next) {
        try {
            const { userId } = req.params;
            const { role, clientId } = req.body || {};
            // req.user = approve karne wala admin, clientService = client + key banane ke liye
            const result = await this.authService.approveUser(userId, req.user, this.clientService, role, clientId);
            res.status(200).json(ResponseFormatter.success(result, "User approved with client and API key", 200))
        } catch (error) {
            next(error)
        }
    }

    /**
     * rejectUser: Pending user ko reject karna.
     * POST /api/auth/admin/users/:userId/reject (SUPER_ADMIN only)
     * Body: { reason } - rejection reason optional
     */
    async rejectUser(req, res, next) {
        try {
            const { userId } = req.params;
            const { reason } = req.body;
            const user = await this.authService.rejectUser(userId, reason, req.user);
            res.status(200).json(ResponseFormatter.success(user, "User rejected successfully", 200))
        } catch (error) {
            next(error)
        }
    }

    /**
     * getPendingUsers: Saare pending approval requests fetch karna.
     * GET /api/auth/admin/pending-users (SUPER_ADMIN only)
     * PendingApprovalsPage.jsx yahi use karta hai list dikhane ke liye.
     */
    async getPendingUsers(req, res, next) {
        try {
            const users = await this.authService.getPendingUsers();
            res.status(200).json(ResponseFormatter.success(users, "Pending users fetched successfully", 200))
        } catch (error) {
            next(error)
        }
    }
}
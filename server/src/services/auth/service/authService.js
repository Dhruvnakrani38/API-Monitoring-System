import config from "../../../shared/config/index.js";
import AppError from "../../../shared/utils/AppError.js";
import jwt from "jsonwebtoken";
import logger from "../../../shared/config/logger.js";
import bcrypt from "bcryptjs";
import { APPLICATION_ROLES } from "../../../shared/constants/roles.js";
import User from "../../../shared/models/User.js";

/**
 * 🔐 AuthService Class
 * Kaam: Authentication aur Authorization operations handle karta hai - Onboarding, Registration, Public Signup, Admin Approvals, Login, aur JWT Token Generation.
 * Reusable: Express Controllers (authController.js) dwara use hota hai. Business logic centralized hai.
 */
export class AuthService {
    constructor(userRepository) {
        if (!userRepository) {
            throw new Error("UserRepository is Required");
        }
        this.userRepository = userRepository;
    }

    /**
     * 🔑 JWT Token Generator Function
     * Kaam: User payload (userId, email, role, clientId) se Signed JWT Token generate karta hai.
     * Reusable: Login/Signup ke baad Auth Cookies ya Authorization Headers me bhejane ke liye reusable.
     */
    generateToken(user) {
        const { _id, email, username, role, clientId } = user;

        const payload = {
            userId: _id,
            username,
            email,
            role,
            clientId
        };

        return jwt.sign(payload, config.jwt.secret, {
            expiresIn: config.jwt.expiresIn
        });
    }

    /**
     * 🧹 Sensitive Data Cleaner
     * Kaam: Client ko user details bhejte waqt password hash drop/delete karta hai.
     */
    formatUserForResponse(user) {
        const userObj = user.toObject ? user.toObject() : { ...user };
        delete userObj.password;
        return userObj;
    }

    /**
     * 🔒 Password Hash Matcher
     * Kaam: Bcrypt se Plaintext Password aur Stored Hashed Password Compare karta hai.
     */
    async comparePassword(userEnteredPassword, hashedPassword) {
        return await bcrypt.compare(userEnteredPassword, hashedPassword);
    }

    /**
     * 👑 Super Admin Setup Function (First Time Bootstrap)
     * Kaam: Agar system me koi user nahi hai, to pehla Super Admin account create karta hai.
     */
    async onboardSuperAdmin(superAdminData) {
        try {
            const existingUser = await this.userRepository.findAll();

            if (existingUser && existingUser.length > 0) {
                throw new AppError("Super admin onboarding is disabled", 403);
            }

            const user = await this.userRepository.create({
                ...superAdminData,
                isApproved: true,
                approvalStatus: 'approved',
                isActive: true
            });
            const token = this.generateToken(user);

            logger.info("Admin onboarded successfully", {
                username: user.username
            });

            return {
                user: this.formatUserForResponse(user),
                token
            };
        } catch (error) {
            logger.error("Error in onboarding Super admin", error);
            throw error;
        }
    }

    /**
     * 📝 Public Client Signup Method (Approval Required Flow)
     * Kaam: Naye users ko `approvalStatus: 'pending'` aur `isActive: false` ke sath create karta hai.
     * Usage: Public `/api/auth/signup` route se call hota hai. Jab tak Admin approve nahi karta, login blocked rehta hai.
     */
    async publicSignup(userData) {
        try {
            const existingUser = await this.userRepository.findByUsername(userData.username);
            if (existingUser) {
                throw new AppError("Username already exists", 409);
            }

            const existingEmail = await this.userRepository.findByEmail(userData.email);
            if (existingEmail) {
                throw new AppError("Email already exists", 409);
            }

            // User account create in PENDING state (Approval needed)
            const user = await this.userRepository.create({
                ...userData,
                role: APPLICATION_ROLES.CLIENT_VIEWER,
                isApproved: false,
                approvalStatus: 'pending',
                isActive: false, // Inactive until Admin approval
                clientId: null
            });

            logger.info("User signup successful - awaiting approval", {
                username: user.username,
                email: user.email
            });

            return {
                user: this.formatUserForResponse(user),
                message: "Account created successfully. Please wait for admin approval."
            };
        } catch (error) {
            logger.error("Error in public signup service", error);
            throw error;
        }
    }

    /**
     * ➕ Admin Direct User Register Method
     * Kaam: Admin dwara directly pre-approved user account create karne ke liye.
     */
    async register(userData) {
        try {
            const existingUser = await this.userRepository.findByUsername(userData.username);
            if (existingUser) {
                throw new AppError("Username already exists", 409);
            }

            const existingEmail = await this.userRepository.findByEmail(userData.email);
            if (existingEmail) {
                throw new AppError("Email already exists", 409);
            }

            const user = await this.userRepository.create({
                ...userData,
                isApproved: true,
                approvalStatus: 'approved',
                isActive: true
            });
            const token = this.generateToken(user);

            logger.info("User registered successfully", {
                username: user.username
            });

            return {
                user: this.formatUserForResponse(user),
                token
            };
        } catch (error) {
            logger.error("Error in Register service", error);
            throw error;
        }
    }

    /**
     * 🔓 User Login Authentication Method
     * Kaam: Credentials verify karta hai aur check karta hai ki user Admin dwara Approved aur Active hai ya nahi.
     * Usage: Public `/api/auth/login` route. Approved hone par JWT cookie/token return karta hai.
     */
    async login(username, password) {
        try {
            const user = await this.userRepository.findByUsername(username);

            if (!user) {
                throw new AppError("Invalid Credentials", 401);
            }

            // Non-SuperAdmin users ke liye approval verification
            if (user.role !== APPLICATION_ROLES.SUPER_ADMIN) {
                if (!user.isApproved || user.approvalStatus !== 'approved') {
                    throw new AppError("Account pending admin approval. Please contact support.", 403);
                }
            }

            if (!user.isActive) {
                throw new AppError("Account is deactivated", 403);
            }

            const isPasswordValid = await this.comparePassword(password, user.password);
            if (!isPasswordValid) {
                throw new AppError("Invalid Credentials", 401);
            }
            const token = this.generateToken(user);

            logger.info("User loggedIn successfully", { username: user.username });

            return {
                user: this.formatUserForResponse(user),
                token
            };

        } catch (error) {
            logger.error("Error in Login service", error);
            throw error;
        }
    }

    /**
     * ✅ Admin User Approval & Auto Client Setup Method
     * Kaam: Pending user ko Approve karta hai, automatically Client Workspace aur API Key (`apim_...`) generate karta hai.
     * Usage: Admin Dashboard (`/api/auth/admin/users/:userId/approve`) dwara invoke hota hai.
     */
    async approveUser(userId, adminUser, clientService, requestedRole = APPLICATION_ROLES.CLIENT_VIEWER, assignedClientId = null) {
        try {
            const normalizedRole = requestedRole === APPLICATION_ROLES.CLIENT_ADMIN ? APPLICATION_ROLES.CLIENT_ADMIN : APPLICATION_ROLES.CLIENT_VIEWER;

            const user = await this.userRepository.findById(userId);
            if (!user) {
                throw new AppError("User not found", 404);
            }

            if (user.approvalStatus === 'approved') {
                throw new AppError("User already approved", 400);
            }

            if (assignedClientId) {
                const client = await clientService.findClientById(assignedClientId);
                if (!client) {
                    throw new AppError("Client not found", 404);
                }

                const finalUser = await this.userRepository.updateSafe(userId, {
                    isApproved: true,
                    approvalStatus: 'approved',
                    isActive: true,
                    role: normalizedRole,
                    clientId: client._id,
                    permissions: clientService.buildPermissionsForRole(normalizedRole),
                    approvedBy: adminUser.userId,
                    approvedAt: new Date()
                });

                return {
                    user: this.formatUserForResponse(finalUser),
                    client,
                    apiKey: null
                };
            }

            // 1. User approval status update in DB
            const updatedUser = await this.userRepository.updateSafe(userId, {
                isApproved: true,
                approvalStatus: 'approved',
                isActive: true,
                role: normalizedRole,
                permissions: clientService.buildPermissionsForRole ? clientService.buildPermissionsForRole(normalizedRole) : {
                    canCreateApiKeys: normalizedRole === APPLICATION_ROLES.CLIENT_ADMIN,
                    canManageUsers: normalizedRole === APPLICATION_ROLES.CLIENT_ADMIN,
                    canViewAnalytics: true,
                    canExportData: normalizedRole === APPLICATION_ROLES.CLIENT_ADMIN,
                },
                approvedBy: adminUser.userId,
                approvedAt: new Date()
            });

            // 2. Client Workspace & API Key Auto-Generation
            const { client, apiKey } = await clientService.createClientWithApiKeyForUser(updatedUser, adminUser, normalizedRole);

            // 3. User model update with created Client ID and role
            const finalUser = await User.findByIdAndUpdate(userId, {
                clientId: client._id,
                role: normalizedRole,
                permissions: clientService.buildPermissionsForRole ? clientService.buildPermissionsForRole(normalizedRole) : {
                    canCreateApiKeys: normalizedRole === APPLICATION_ROLES.CLIENT_ADMIN,
                    canManageUsers: normalizedRole === APPLICATION_ROLES.CLIENT_ADMIN,
                    canViewAnalytics: true,
                    canExportData: normalizedRole === APPLICATION_ROLES.CLIENT_ADMIN,
                }
            }, { new: true });

            logger.info("User approved with client and API key", {
                userId,
                role: normalizedRole,
                approvedBy: adminUser.username,
                clientId: client._id,
                apiKey: apiKey.keyId
            });

            return {
                user: this.formatUserForResponse(finalUser),
                client,
                apiKey
            };
        } catch (error) {
            logger.error("Error approving user", error);
            throw error;
        }
    }

    /**
     * Rejects a pending user registration.
     * @param {string} userId - The ID of the user to reject.
     * @param {string} reason - The reason for rejection.
     * @param {Object} adminUser - The admin user rejecting the registration.
     * @returns {Promise<Object>} - Returns the rejected user.
     */
    async rejectUser(userId, reason, adminUser) {
        try {
            const user = await this.userRepository.findById(userId);
            if (!user) {
                throw new AppError("User not found", 404);
            }

            if (user.approvalStatus === 'rejected') {
                throw new AppError("User already rejected", 400);
            }

            // Update user rejection status
            const updatedUser = await this.userRepository.updateSafe(userId, {
                isApproved: false,
                approvalStatus: 'rejected',
                isActive: false,
                approvedBy: adminUser.userId,
                approvedAt: new Date(),
                rejectionReason: reason
            });

            logger.info("User rejected successfully", {
                userId,
                approvedBy: adminUser.username,
                reason
            });

            return this.formatUserForResponse(updatedUser);
        } catch (error) {
            logger.error("Error rejecting user", error);
            throw error;
        }
    }

    /**
     * Gets all pending user registrations.
     * @returns {Promise<Array>} - Returns list of pending users.
     */
    async getPendingUsers() {
        try {
            const pendingUsers = await this.userRepository.findByApprovalStatus('pending');
            return pendingUsers.map(user => this.formatUserForResponse(user));
        } catch (error) {
            logger.error("Error getting pending users", error);
            throw error;
        }
    }

    /**
     * Fetches the profile of a user by their ID.
     * @param {string} userId - The ID of the user.
     * @returns {Promise<Object>} - Returns the user's profile data.
     */
    async getProfile(userId) {
        try {
            const user = await this.userRepository.findById(userId);
            if (!user) {
                throw new AppError('User not found', 404);
            }
            return this.formatUserForResponse(user)
        } catch (error) {
            logger.error('Error getting user profile:', error);
            throw error;
        }
    };


    async checkSuperAdminPermissions(userId) {
        try {
            const user = await this.userRepository.findById(userId);
            if (!user) {
                throw new AppError("User not found", 404);
            }

            return user.role === APPLICATION_ROLES.SUPER_ADMIN
        } catch (error) {

        }
    }
}
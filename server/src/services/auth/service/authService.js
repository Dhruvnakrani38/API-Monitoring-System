import config from "../../../shared/config/index.js";
import AppError from "../../../shared/utils/AppError.js";
import jwt from "jsonwebtoken";
import logger from "../../../shared/config/logger.js"
import bcrypt from "bcryptjs";
import { APPLICATION_ROLES } from "../../../shared/constants/roles.js";
import User from "../../../shared/models/User.js";

/**
 * AuthService handles user authentication and authorization related operations such as onboarding super admin, user registration, login, and fetching user profile.
 * It interacts with the UserRepository to perform these operations and generates JWT tokens for authenticated users.
 */
export class AuthService {
    constructor(userRepository) {
        if (!userRepository) {
            throw new Error("UserRepository is Required");
        }
        this.userRepository = userRepository;
    };

    /**
     * Generates a JWT token for the given user.
     * @param {Object} user - The user object for which the token is generated.
     * @returns {string} - The generated JWT token.
     */
    generateToken(user) {
        const { _id, email, username, role, clientId } = user;

        const payload = {
            userId: _id,
            username,
            email,
            role,
            clientId
        }

        return jwt.sign(payload, config.jwt.secret, {
            expiresIn: config.jwt.expiresIn
        })
    }

    /**
     * Formats the user object for response by removing sensitive information.
     * @param {Object} user - The user object to be formatted.
     * @returns {Object} - The formatted user object.
     */
    formatUserForResponse(user) {
        const userObj = user.toObject ? user.toObject() : { ...user };
        delete userObj.password;
        return userObj;
    };

    /**
     * Compares the user-entered password with the hashed password.
     * @param {string} userEnteredPassword - The password entered by the user.
     * @param {string} hashedPassword - The hashed password stored in the database.
     * @returns {Promise<boolean>} - Returns true if the passwords match, otherwise false.
     */
    async comparePassword(userEnteredPassword, hashedPassword) {
        return await bcrypt.compare(userEnteredPassword, hashedPassword)
    }

    /**
     * Onboards a new super admin user.
     * @param {Object} superAdminData - The data of the super admin to be onboarded.
     * @returns {Promise<Object>} - Returns an object containing the user and token.
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
            })

            return {
                user: this.formatUserForResponse(user),
                token
            }
        } catch (error) {
            logger.error("Error in onboarding Super admin", error)
            throw error
        }
    };

    /**
     * Registers a new user (public signup - requires admin approval).
     * @param {Object} userData - The data of the user to be registered.
     * @returns {Promise<Object>} - Returns the created user (no token until approved).
     */
    async publicSignup(userData) {
        try {
            const existingUser = await this.userRepository.findByUsername(userData.username)
            if (existingUser) {
                throw new AppError("Username already exists", 409)
            };

            const existingEmail = await this.userRepository.findByEmail(userData.email)
            if (existingEmail) {
                throw new AppError("Email already exists", 409)
            };

            // Create user with pending approval status
            const user = await this.userRepository.create({
                ...userData,
                role: APPLICATION_ROLES.CLIENT_VIEWER,
                isApproved: false,
                approvalStatus: 'pending',
                isActive: false, // Inactive until approved
                clientId: null // No client until approved
            });

            logger.info("User signup successful - awaiting approval", {
                username: user.username,
                email: user.email
            })

            return {
                user: this.formatUserForResponse(user),
                message: "Account created successfully. Please wait for admin approval."
            }
        } catch (error) {
            logger.error("Error in public signup service", error)
            throw error
        }
    };

    /**
     * Registers a new user (admin only - no approval needed).
     * @param {Object} userData - The data of the user to be registered.
     * @returns {Promise<Object>} - Returns an object containing the user and token.
     */
    async register(userData) {
        try {
            const existingUser = await this.userRepository.findByUsername(userData.username)
            if (existingUser) {
                throw new AppError("Username already exists", 409)
            };

            const existingEmail = await this.userRepository.findByEmail(userData.email)
            if (existingEmail) {
                throw new AppError("Email already exists", 409)
            };

            const user = await this.userRepository.create({
                ...userData,
                isApproved: true,
                approvalStatus: 'approved',
                isActive: true
            });
            const token = this.generateToken(user);

            logger.info("User registered successfully", {
                username: user.username
            })

            return {
                user: this.formatUserForResponse(user),
                token
            }
        } catch (error) {
            logger.error("Error in Register service", error)
            throw error
        }
    };

    /**
     * Logs in a user.
     * @param {string} username - The username of the user.
     * @param {string} password - The password of the user.
     * @returns {Promise<Object>} - Returns an object containing the user and token.
     */
    async login(username, password) {
        try {
            const user = await this.userRepository.findByUsername(username);

            if (!user) {
                throw new AppError("Invalid Credentials", 401);
            };

            // Check if user is approved (super admins bypass approval check)
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

            logger.info("User loggedIn successfully", { username: user.username })

            return {
                user: this.formatUserForResponse(user),
                token
            }

        } catch (error) {
            logger.error("Error in Login service", error)
            throw error
        }
    };


    /**
     * Approves a pending user registration and creates client + API key.
     * @param {string} userId - The ID of the user to approve.
     * @param {Object} adminUser - The admin user approving the registration.
     * @param {Object} clientService - The client service instance.
     * @returns {Promise<Object>} - Returns the approved user with client and API key.
     */
    async approveUser(userId, adminUser, clientService) {
        try {
            const user = await this.userRepository.findById(userId);
            if (!user) {
                throw new AppError("User not found", 404);
            }

            if (user.approvalStatus === 'approved') {
                throw new AppError("User already approved", 400);
            }

            // Update user approval status
            const updatedUser = await this.userRepository.updateSafe(userId, {
                isApproved: true,
                approvalStatus: 'approved',
                isActive: true,
                approvedBy: adminUser.userId,
                approvedAt: new Date()
            });

            // Create client and API key for the approved user
            const { client, apiKey } = await clientService.createClientWithApiKeyForUser(updatedUser, adminUser);

            // Update user with client info using User model directly
            const finalUser = await User.findByIdAndUpdate(userId, {
                clientId: client._id
            }, { new: true });

            logger.info("User approved with client and API key", {
                userId,
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
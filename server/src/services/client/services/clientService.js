// =====================================================================
// clientService.js
// Kaam: Client management ka core business logic yahan hota hai.
// Includes: Client create, Client user create, API key generate/manage,
//           aur approval workflow ke liye createClientWithApiKeyForUser.
// Reusability: clientController aur authService.approveUser dono use karte hain.
// =====================================================================

import logger from "../../../shared/config/logger.js";
import { APPLICATION_ROLES, isValidClientRole, normalizeClientRole } from "../../../shared/constants/roles.js";
import AppError from "../../../shared/utils/AppError.js";
import { v4 as uudiv4 } from "uuid";
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import User from "../../../shared/models/User.js";

/**
 * ClientService: Client se related saari business logic handle karta hai.
 * Repositories: clientRepository, apiKeyRepository, userRepository inject hote hain.
 */
export class ClientService {
    /**
     * Constructor: Teen repositories inject hoti hain (DI pattern).
     * clientRepository: Client CRUD
     * apiKeyRepository: API Key CRUD
     * userRepository: User update ke liye (clientId assign karna)
     */
    constructor(dependencies) {
        if (!dependencies) {
            throw new Error('Dependencies are required');
        };

        if (!dependencies.clientRepository) {
            throw new Error('ClientRepository is required');
        };

        if (!dependencies.apiKeyRepository) {
            throw new Error('ApiKeyRepository is required');
        }
        if (!dependencies.userRepository) {
            throw new Error('UserRepository is required');
        }

        // Assign dependencies to instance variables
        this.clientRepository = dependencies.clientRepository;
        this.apiKeyRepository = dependencies.apiKeyRepository;
        this.userRepository = dependencies.userRepository;
    };

    /**
     * formatClientForResponse: User object se password remove karta hai.
     * Reusability: createClientUser ke response format karne ke liye.
     */
    formatClientForResponse(user) {
        const userObj = user.toObject ? user.toObject() : { ...user };
        delete userObj.password; // Password field hata do - sensitive data
        return userObj;
    };

    /**
     * generateSlug: Client ke naam se URL-friendly slug generate karta hai.
     * Example: "My Company" => "my-company"
     * Reusability: createClient me slug banana ke liye use hota hai.
     */
    generateSlug(name) {
        return name.toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '') // Special chars hata do
            .replace(/\s+/g, '-')          // Spaces ko dash se replace karo
            .replace(/-+/g, '-')           // Multiple dashes ko ek karo
            .trim()
    }

    /**
     * createClient: Naya client (organization) create karna.
     * Slug generate karta hai aur duplicate check karta hai.
     * Reusability: clientController.createClient aur
     *              createClientWithApiKeyForUser me use hota hai.
     */
    async createClient(clientData, adminUser) {
        try {
            const { name, email, description, website } = clientData;

            // URL-friendly slug generate karo name se
            const slug = this.generateSlug(name);

            // Duplicate slug check - same name wala client already exist toh nahi karta?
            const exisitingClient = await this.clientRepository.findBySlug(slug);

            if (exisitingClient) {
                throw new AppError(`Client with slug ${slug} already exists`, 400);
            }

            // MongoDB me save karo
            const client = await this.clientRepository.create({
                name,
                slug,
                email,
                description,
                website,
                createdBy: adminUser.userId // Kis admin ne banaya
            });

            return client;
        } catch (error) {
            logger.error('Error creating client:', error);
            throw error;
        }
    };

    async findClientById(clientId) {
        return this.clientRepository.findById(clientId);
    }

    async getClients(user) {
        if (user.role !== APPLICATION_ROLES.SUPER_ADMIN) {
            throw new AppError("Access denied", 403);
        }

        return this.clientRepository.find({ isActive: true }, { limit: 200 });
    }

    async getClientUsers(clientId, user) {
        if (![APPLICATION_ROLES.SUPER_ADMIN, APPLICATION_ROLES.CLIENT_ADMIN].includes(user.role)
            || !this.canUserAccessClient(user, clientId)) {
            throw new AppError("Access denied", 403);
        }

        if (!await this.clientRepository.findById(clientId)) {
            throw new AppError("Client not found", 404);
        }

        return this.userRepository.findByClientId(clientId);
    }

    async getClientProfile(clientId) {
        const client = await this.clientRepository.findById(clientId);
        if (!client) return null;

        const owner = client.createdBy ? await this.userRepository.findById(client.createdBy) : null;
        return {
            _id: client._id,
            name: client.name,
            slug: client.slug,
            email: client.email,
            description: client.description,
            website: client.website,
            isActive: client.isActive,
            createdAt: client.createdAt,
            createdBy: owner ? {
                username: owner.username,
                email: owner.email,
                role: owner.role,
            } : null,
        };
    }

    /**
     * createClientWithApiKeyForUser: Admin approval ke waqt use hota hai.
     * Yeh ek atomic-ish operation hai:
     *   1. User ke naam par client create karo
     *   2. User ke record me clientId update karo
     *   3. API key generate karo
     * Reusability: authService.approveUser yahi call karta hai.
     */
    async createClientWithApiKeyForUser(userData, adminUser, assignedRole = userData.role || APPLICATION_ROLES.CLIENT_VIEWER) {
        try {
            const normalizedRole = normalizeClientRole(assignedRole);

            // Step 1: User ke username se client data banao
            const clientData = {
                name: userData.username + "'s Client",
                email: userData.email,
                description: `Auto-generated client for approved ${normalizedRole} user`,
                website: ""
            };

            const client = await this.createClient(clientData, adminUser);

            // Step 2: User record me naya clientId + role + permissions update karo
            const permissions = this.buildPermissionsForRole(normalizedRole);
            await User.findByIdAndUpdate(userData._id, {
                clientId: client._id,
                role: normalizedRole,
                permissions,
                isActive: true,
                isApproved: true,
                approvalStatus: 'approved',
                approvedBy: adminUser.userId,
                approvedAt: new Date()
            });

            // Step 3: Default API key generate karo
            const keyData = {
                name: "Default API Key",
                description: `Auto-generated API key for approved ${normalizedRole} user`,
                environment: "production"
            };

            const apiKey = await this.createApiKey(client._id, keyData, adminUser);

            logger.info("Client and API key created for approved user", {
                userId: userData._id,
                role: normalizedRole,
                clientId: client._id,
                apiKey: apiKey.keyId
            });

            return {
                client,
                apiKey
            };
        } catch (error) {
            logger.error('Error creating client with API key for user:', error);
            throw error;
        }
    }

    buildPermissionsForRole(role) {
        const normalizedRole = normalizeClientRole(role);

        if (normalizedRole === APPLICATION_ROLES.CLIENT_ADMIN) {
            return {
                canCreateApiKeys: true,
                canManageUsers: true,
                canViewAnalytics: true,
                canExportData: true,
            };
        }

        return {
            canCreateApiKeys: false,
            canManageUsers: false,
            canViewAnalytics: true,
            canExportData: false,
        };
    }

    /**
     * canUserAccessClient: User ke paas kisi client ka access hai ya nahi check karna.
     * Super admin = har client access kar sakta hai.
     * Normal user = sirf apne clientId wala client access kar sakta hai.
     * Reusability: createClientUser, createApiKey, getClientApiKeys me use hota hai.
     */
    canUserAccessClient(user, clientId) {
        if (user.role === APPLICATION_ROLES.SUPER_ADMIN) {
            return true // Super admin = sabka access
        }

        // Normal user: apna clientId match karo
        return user.clientId && user.clientId.toString() === clientId.toString()
    }

    /**
     * createClientUser: Kisi existing client ke liye naya user banana.
     * Role-based permissions automatically assign hoti hain:
     *   - CLIENT_ADMIN: sabki permissions
     *   - CLIENT_VIEWER: sirf analytics dekh sakta hai
     */
    async createClientUser(clientId, userData, adminUser) {
        try {
            if (![APPLICATION_ROLES.SUPER_ADMIN, APPLICATION_ROLES.CLIENT_ADMIN].includes(adminUser.role)) {
                throw new AppError("Only client admins can add users", 403);
            }

            // Pehle check karo: requester ke paas access hai?
            if (!this.canUserAccessClient(adminUser, clientId)) {
                throw new AppError("Access denied", 403)
            };

            const { username, email, password, role = APPLICATION_ROLES.CLIENT_VIEWER } = userData;
            const normalizedRole = normalizeClientRole(role);

            // Valid role check (client_admin ya client_viewer)
            if (!isValidClientRole(normalizedRole)) {
                throw new AppError("Invalid role for client user", 400)
            };

            // Client exist karta hai?
            const client = await this.clientRepository.findById(clientId);

            if (!client) {
                throw new AppError("Client not found", 404)
            };

            const permissions = this.buildPermissionsForRole(normalizedRole);

            // User create karo userRepository ke through
            const user = await this.userRepository.create({
                username,
                email,
                password,
                role: normalizedRole,
                clientId,
                permissions,
                isActive: true,
                isApproved: true,
                approvalStatus: 'approved'
            });

            logger.info("Client user created", {
                clientId,
                userId: user._id,
                role
            })

            // Password exclude karke return karo
            return this.formatClientForResponse(user)

        } catch (error) {
            logger.error("Error creating client user", error)
            throw error;
        }
    };

    /**
     * generateApiKey: Cryptographically secure API key generate karta hai.
     * Format: apim_<40 char hex string>
     * Reusability: createApiKey method me use hota hai.
     */
    generateApiKey() {
        const prefix = "apim";
        const randomBytes = crypto.randomBytes(20).toString("hex"); // 20 bytes = 40 hex chars
        return `${prefix}_${randomBytes}`
    }

    /**
     * createApiKey: Kisi client ke liye naya API key create karna.
     * Sirf SUPER_ADMIN aur CLIENT_ADMIN yeh kar sakte hain.
     * keyId = UUID (unique identifier), keyValue = actual secret key.
     * Reusability: clientController.createApiKey aur
     *              createClientWithApiKeyForUser me use hota hai.
     */
    async createApiKey(clientId, keyData, user) {
        try {
            // Client exist karta hai?
            const client = await this.clientRepository.findById(clientId);

            if (!client) {
                throw new AppError("Client not found", 404)
            };

            // Access check
            if (!this.canUserAccessClient(user, clientId)) {
                throw new AppError("Access denied", 403)
            };

            // Sirf admin roles API key create kar sakte hain
            if (!(user.role === APPLICATION_ROLES.SUPER_ADMIN || user.role === APPLICATION_ROLES.CLIENT_ADMIN)) {
                throw new AppError("Access denied - Only Super Admin and Client Admin can create API keys", 403)
            };


            const { name, description, environment = "production" } = keyData;

            // UUID = unique keyId, crypto = secure random keyValue
            const keyId = uudiv4();
            const keyValue = this.generateApiKey();

            // Database me save karo
            const apiKey = await this.apiKeyRepository.create({
                keyId,
                keyValue,
                clientId,
                name,
                description,
                environment,
                createdBy: user.userId
            });

            return apiKey;
        } catch (error) {
            logger.error("Error creating API key", error)
            throw error;
        }
    };


    /**
     * getClientApiKeys: Kisi client ki saari API keys list karna.
     * keyValue response me nahi aata (security ke liye strip hoti hai).
     * Reusability: clientController.getClientApiKeys me use hota hai.
     */
    async getClientApiKeys(clientId, user) {
        try {
            if (![APPLICATION_ROLES.SUPER_ADMIN, APPLICATION_ROLES.CLIENT_ADMIN].includes(user.role)) {
                throw new AppError('Only client admins can access API keys', 403);
            }

            if (!this.canUserAccessClient(user, clientId)) {
                throw new AppError('Access denied to this client', 403);
            };

            const apiKeys = await this.apiKeyRepository.findByClientId(clientId);

            // keyValue field hata do - actual key client ko pehle create pe dikhti hai
            const formattedResponse = apiKeys.map(key => {
                const keyObj = key.toObject ? key.toObject() : key;
                delete keyObj.keyValue; // Sensitive data remove karo
                return keyObj
            })

            return formattedResponse

        } catch (error) {
            logger.error('Error getting client API keys:', error);
            throw error;
        }
    };

    async revealClientApiKeys(clientId, user, password) {
        if (![APPLICATION_ROLES.SUPER_ADMIN, APPLICATION_ROLES.CLIENT_ADMIN].includes(user.role)
            || !this.canUserAccessClient(user, clientId)) {
            throw new AppError('Access denied to this client', 403);
        }

        if (!password) {
            throw new AppError('Password confirmation is required', 400);
        }

        const account = await this.userRepository.findById(user.userId);
        if (!account || !await bcrypt.compare(password, account.password)) {
            throw new AppError('Password confirmation failed', 401);
        }

        const keys = await this.apiKeyRepository.findByClientId(clientId, { isActive: true });
        return keys.map((key) => {
            const keyData = key.toObject ? key.toObject() : key;
            return {
                keyId: keyData.keyId,
                keyValue: keyData.keyValue,
                name: keyData.name,
                description: keyData.description,
                environment: keyData.environment,
                createdAt: keyData.createdAt,
                expiresAt: keyData.expiresAt,
            };
        });
    }

    /**
     * getClientByApiKey: API key value se client dhundhna.
     * validateApiKey middleware me use hota hai incoming requests authenticate karne ke liye.
     * Expired ya inactive keys null return karti hain.
     * Reusability: validateApiKey.js middleware yahi call karta hai.
     */
    async getClientByApiKey(apiKey) {
        try {
            const key = await this.apiKeyRepository.findByKeyValue(apiKey);

            // Key nahi mili to null
            if (!key) {
                return null;
            }

            // Expired key check
            if (key.isExpired()) {
                return null;
            }

            // Populated client return karo (key ke saath)
            const client = key.clientId;

            return {
                client,
                apiKey: key,
            };
        } catch (error) {
            logger.error('Error finding client by API key:', error);
            throw error;
        }
    }
}
// =====================================================================
// clientController.js
// Kaam: Client management ke saare HTTP endpoints yahan handle hote hain.
// Includes: Client create, Client user create, API key create/fetch.
// Reusability: clientRoutes.js me use hota hai.
// clientService se actual business logic hoti hai.
// =====================================================================

import ResponseFormatter from "../../../shared/utils/responseFormatter.js"

/**
 * ClientController: Client operations ke liye HTTP request handler.
 * clientService: actual logic karta hai
 * authService: super admin check ke liye
 */
export class ClientController {
    /**
     * Constructor: clientService aur authService inject hote hain.
     * Dono missing ho to error - DI pattern enforce karta hai.
     */
    constructor(clientService, authService) {
        // Validate dependencies
        if (!clientService) {
            throw new Error('ClientService is required');
        };

        if (!authService) {
            throw new Error('authService is required');
        };

        // Assign dependencies to instance variables
        this.clientService = clientService;
        this.authService = authService;
    };


    /**
     * createClient: Naya client (organization) create karna.
     * POST /api/admin/clients/onboard (SUPER_ADMIN only)
     * Pehle super admin permission check hoti hai, phir client banta hai.
     */
    async createClient(req, res, next) {
        try {
            // Super admin hai ya nahi check karo
            const isSuperAdmin = await this.authService.checkSuperAdminPermissions(req.user.userId);
            if (!isSuperAdmin) {
                return res.status(403).json(ResponseFormatter.error("Access denied", 403))
            };

            // req.body me name, email, description, website expected
            const client = await this.clientService.createClient(req.body, req.user);

            return res.status(201).json(ResponseFormatter.success(client, "Client created successfully", 201))
        } catch (error) {
            next(error)
        }
    }

    /**
     * createClientUser: Kisi client ke liye naya user banana.
     * POST /api/admin/clients/:clientId/users
     * clientId URL parameter se aata hai.
     * clientService check karta hai ki requester ke paas access hai ya nahi.
     */
    async createClientUser(req, res, next) {
        try {
            const { clientId } = req.params; // URL se clientId nikaalo
            const user = await this.clientService.createClientUser(clientId, req.body, req.user)
            return res.status(201).json(ResponseFormatter.success(user, "Client user created successfully", 201))
        } catch (error) {
            next(error)
        }
    }

    async getClients(req, res, next) {
        try {
            const clients = await this.clientService.getClients(req.user);
            return res.status(200).json(ResponseFormatter.success(clients, "Clients fetched successfully", 200));
        } catch (error) {
            next(error);
        }
    }

    async getClientUsers(req, res, next) {
        try {
            const users = await this.clientService.getClientUsers(req.params.clientId, req.user);
            return res.status(200).json(ResponseFormatter.success(users, "Client users fetched successfully", 200));
        } catch (error) {
            next(error);
        }
    }


    /**
     * createApiKey: Kisi client ke liye naya API key banana.
     * POST /api/admin/clients/:clientId/api/keys
     * Sirf SUPER_ADMIN aur CLIENT_ADMIN yeh kar sakte hain.
     * API key automatically generate hoti hai (prefix: apim_xxxxx).
     */
    async createApiKey(req, res, next) {
        try {
            const { clientId } = req.params;
            const apiKey = await this.clientService.createApiKey(clientId, req.body, req.user)
            return res.status(201).json(ResponseFormatter.success(apiKey, "API key created successfully", 201))
        } catch (error) {
            next(error)
        }
    };

    /**
     * getClientApiKeys: Kisi client ki saari API keys fetch karna.
     * GET /api/admin/clients/:clientId/api/keys
     * keyValue field response me nahi aata (security ke liye remove hoti hai).
     * Reusability: Settings page ya key management UI me use ho sakta hai.
     */
    async getClientApiKeys(req, res, next) {
        try {
            const { clientId } = req.params;
            const apiKey = await this.clientService.getClientApiKeys(clientId, req.user)
            return res.status(200).json(ResponseFormatter.success(apiKey, "API key fetched successfully", 200))
        } catch (error) {
            next(error)
        }
    }

    async revealClientApiKeys(req, res, next) {
        try {
            const keys = await this.clientService.revealClientApiKeys(
                req.params.clientId,
                req.user,
                req.body.password,
            );
            return res.status(200).json(ResponseFormatter.success(keys, "API keys revealed after password verification", 200));
        } catch (error) {
            next(error);
        }
    }
}
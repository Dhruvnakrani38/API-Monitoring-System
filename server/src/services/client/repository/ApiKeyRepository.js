// =====================================================================
// ApiKeyRepository.js
// Kaam: MongoDB me API Key collection ke database operations.
// BaseApiKeyRepository extend karta hai.
// Reusability: clientService (create, getClientByApiKey, getClientApiKeys) aur
//              validateApiKey middleware me use hota hai.
// =====================================================================

import logger from "../../../shared/config/logger.js";
import ApiKey from "../../../shared/models/ApiKey.js"
import BaseApiKeyRepository from "./BaseApiKeyRepository.js"

/**
 * MongoApiKeyRepository: API Key collection ke liye MongoDB CRUD implementation.
 */
class MongoApiKeyRepository extends BaseApiKeyRepository {
    // Constructor: ApiKey Mongoose model pass karo
    constructor() {
        super(ApiKey)
    }

    /**
     * create: Naya API key MongoDB me save karna.
     * apiKeyData: { keyId, keyValue, clientId, name, description, environment, createdBy }
     * Reusability: clientService.createApiKey me use hota hai.
     */
    async create(apiKeyData) {
        try {
            const apiKey = new this.model(apiKeyData);
            await apiKey.save();
            logger.info('API key created in database', { keyId: apiKey.keyId });
            return apiKey;
        } catch (error) {
            logger.error('Error creating API key in database:', error);
            throw error;
        }
    }

    /**
     * findByKeyValue: Actual API key string se key dhundhna.
     * includeInactive: false = sirf active keys dhundho (default)
     * .populate('clientId') = client ka poora object key ke saath aata hai.
     * Reusability: clientService.getClientByApiKey me use hota hai,
     *              jo validateApiKey middleware use karta hai.
     */
    async findByKeyValue(keyValue, includeInactive = false) {
        try {
            const filter = { keyValue };
            if (!includeInactive) {
                filter.isActive = true; // Sirf active keys
            }

            // populate: clientId se poora Client document join karo
            const apiKey = await this.model.findOne(filter).populate('clientId');
            return apiKey;
        } catch (error) {
            logger.error('Error finding API key by value:', error);
            throw error;
        }
    }



    /**
     * findByClientId: Kisi client ki saari API keys nikalna.
     * filters: extra MongoDB query conditions
     * Sorted by newest first (createdAt: -1).
     * Reusability: clientService.getClientApiKeys me use hota hai.
     */
    async findByClientId(clientId, filters = {}) {
        try {
            const query = { clientId, ...filters };
            const apiKeys = await this.model.find(query)
                .populate('createdBy', 'username email') // Kis user ne banaya
                .sort({ createdAt: -1 });               // Newest first

            return apiKeys;
        } catch (error) {
            logger.error('Error finding API keys by client ID:', error);
            throw error;
        }
    }


    /**
     * countByClientId: Kisi client ke API keys ki count.
     * filters se additional conditions lagao.
     */
    async countByClientId(clientId, filters = {}) {
        try {
            const query = { clientId, ...filters };
            const count = await this.model.countDocuments(query);
            return count;
        } catch (error) {
            logger.error('Error counting API keys:', error);
            throw error;
        }
    }
}

// Singleton export
export default new MongoApiKeyRepository();
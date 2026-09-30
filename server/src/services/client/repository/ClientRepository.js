// =====================================================================
// ClientRepository.js
// Kaam: MongoDB me Client collection ke database operations.
// BaseClientRepository extend karta hai - actual DB calls Mongoose se.
// Reusability: clientService, analyticsController, aur validateApiKey me use hota hai.
// =====================================================================

import BaseClientRepository from "./BaseClientRepository.js";
import Client from "../../../shared/models/Client.js";
import logger from "../../../shared/config/logger.js"

/**
 * MongoClientRepository: Client collection ke liye MongoDB CRUD implementation.
 * create, findById, findBySlug, find, count methods provide karta hai.
 */
class MongoClientRepository extends BaseClientRepository {
    // Constructor: Client Mongoose model pass karo
    constructor() {
        super(Client)
    }

    /**
     * create: Naya client MongoDB me save karna.
     * clientData: { name, slug, email, description, website, createdBy }
     * Reusability: clientService.createClient me use hota hai.
     */
    async create(clientData) {
        try {
            const client = new this.model(clientData);
            await client.save();

            logger.info('Client created in MongoDB', {
                mongoId: client._id,
                slug: client.slug
            });

            return client;
        } catch (error) {
            logger.error('Error creating client in db', error);
            throw error
        }
    }

    /**
     * findById: MongoDB _id se client dhundhna.
     * Reusability: analyticsController.resolveFinalClientId aur
     *              clientService.createClientUser, createApiKey me use hota hai.
     */
    async findById(clientId) {
        try {
            const client = await this.model.findById(clientId);

            logger.info('Client details from MongoDB', client);

            return client
        } catch (error) {
            logger.error('Error finding client in db by id', error);
            throw error
        }
    };

    /**
     * findBySlug: Unique slug se client dhundhna.
     * Reusability: clientService.createClient me duplicate slug check ke liye.
     */
    async findBySlug(slug) {
        try {
            const client = await this.model.findOne({ slug });
            return client;
        } catch (error) {
            logger.error('Error finding client by slug:', error);
            throw error;
        }
    }

    /**
     * find: Filters ke saath clients ki list nikalna (paginated).
     * options: { limit, skip, sort }
     * Default: limit=50, sort by createdAt desc
     */
    async find(filters = {}, options = {}) {
        try {
            const { limit = 50, skip = 0, sort = { createdAt: -1 } } = options;

            const clients = await this.model.find(filters)
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .select('-__v'); // __v (version key) hata do

            return clients;
        } catch (error) {
            logger.error('Error finding clients:', error);
            throw error;
        }
    }

    /**
     * count: Filters ke matching clients ki count karna.
     * Reusability: Admin dashboards me total client count ke liye.
     */
    async count(filters = {}) {
        try {
            const count = await this.model.countDocuments(filters);
            return count;
        } catch (error) {
            logger.error('Error counting clients:', error);
            throw error;
        }
    }
}


// Singleton export - puri app me ek hi instance
export default new MongoClientRepository()
import { BaseRepository } from "./BaseRepository.js";
import mongoose from 'mongoose';


export class ApiHitRepository extends BaseRepository {
    // Repository ko Mongo model aur shared logger ke saath initialize karo.
    constructor({ model, logger: l } = {}) {
        super({ logger: l })
        if (!model) {
            throw new Error("ApiHitRepository required mongoose model");
        }
        this.model = model;
    }


    // Raw event persist karo; duplicate event ID ko safely skip karo.
    async save(eventData) {
        try {
            const doc = new this.model(eventData);
            await doc.save();

            this.logger.debug("API hit saved to MongoDB", { eventId: eventData.eventId })

            return doc;
        } catch (error) {
            if (error && error.code === 11000) {
                this.logger.warn('Duplicate event ID, skipping save', { eventId: eventData.eventId });
                return null;
            }
            this.logger.error('Error saving API hit:', error);
            throw error;
        }
    }

    // Filter, pagination aur sort options ke saath raw hits read karo.
    async find(filer = {}, options = {}) {
        try {
            const { limit = 100, skip = 0, sort = { timestamp: -1 } } = options;
            const hits = await this.model.find(filer).sort(sort).limit(limit).skip(skip).lean();

            return hits;
        } catch (error) {
            this.logger.error('Error finding API hits:', error);
            throw error;
        }
    };


    // Diye gaye filters se matching raw hit documents ki ginti lo.
    async count(filters = {}) {
        try {
            const count = await this.model.countDocuments(filters);
            return count;
        } catch (error) {
            this.logger.error('Error counting API hits:', error);
            throw error;
        }
    }

    async getEndpointDetails({ clientId, serviceName, endpoint, method, startTime, endTime, recentLimit = 20 }) {
        try {
            const match = {
                clientId: new mongoose.Types.ObjectId(clientId),
                serviceName,
                endpoint,
                method,
            };

            if (startTime || endTime) {
                match.timestamp = {};
                if (startTime) match.timestamp.$gte = startTime;
                if (endTime) match.timestamp.$lte = endTime;
            }

            const [result = {}] = await this.model.aggregate([
                { $match: match },
                {
                    $facet: {
                        summary: [{
                            $group: {
                                _id: null,
                                totalRequests: { $sum: 1 },
                                successfulRequests: { $sum: { $cond: [{ $lt: ['$statusCode', 400] }, 1, 0] } },
                                failedRequests: { $sum: { $cond: [{ $gte: ['$statusCode', 400] }, 1, 0] } },
                                averageLatency: { $avg: '$latencyMs' },
                                minimumLatency: { $min: '$latencyMs' },
                                maximumLatency: { $max: '$latencyMs' },
                            },
                        }],
                        statusBreakdown: [
                            { $group: { _id: '$statusCode', count: { $sum: 1 } } },
                            { $sort: { _id: 1 } },
                        ],
                        recentFailures: [
                            { $match: { statusCode: { $gte: 400 } } },
                            { $sort: { timestamp: -1 } },
                            { $limit: recentLimit },
                            { $project: { _id: 0, timestamp: 1, method: 1, statusCode: 1, latencyMs: 1 } },
                        ],
                    },
                },
            ]);

            return {
                summary: result.summary?.[0] || {},
                statusBreakdown: result.statusBreakdown || [],
                recentFailures: result.recentFailures || [],
            };
        } catch (error) {
            this.logger.error('Error getting endpoint details:', error);
            throw error;
        }
    }

    // Retention cutoff se purane raw hit documents delete karo.
    async deleteOldHits(beforeDate) {
        try {
            const result = await this.model.deleteMany({ timestamp: { $lt: beforeDate } });
            this.logger.info('Deleted old API hits', { count: result.deletedCount });
            return result.deletedCount;
        } catch (error) {
            this.logger.error('Error deleting old API hits:', error);
            throw error;
        }
    }
}
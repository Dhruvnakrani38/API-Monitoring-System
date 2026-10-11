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

    /**
     * getLatencyPercentilesAndSla: Calculates p50, p90, p95, p99 tail latency percentiles
     * and SLA availability and latency compliance scores.
     */
    async getLatencyPercentilesAndSla({ clientId, serviceName, endpoint, method, startTime, endTime, targetLatencyMs = 500, slaTargetUptime = 99.9 } = {}) {
        try {
            const match = {};
            if (clientId) {
                match.clientId = new mongoose.Types.ObjectId(clientId);
            }
            if (serviceName) match.serviceName = serviceName;
            if (endpoint) match.endpoint = endpoint;
            if (method) match.method = method;

            if (startTime || endTime) {
                match.timestamp = {};
                if (startTime) match.timestamp.$gte = new Date(startTime);
                if (endTime) match.timestamp.$lte = new Date(endTime);
            }

            const hits = await this.model.find(match, { latencyMs: 1, statusCode: 1 }).lean();
            if (!hits || hits.length === 0) {
                return {
                    totalRequests: 0,
                    percentiles: { p50: 0, p90: 0, p95: 0, p99: 0 },
                    sla: {
                        uptimePercentage: 100,
                        targetUptime: slaTargetUptime,
                        isUptimeCompliant: true,
                        latencyCompliancePercentage: 100,
                        targetLatencyMs,
                        isLatencyCompliant: true,
                        status: 'compliant',
                    },
                };
            }

            const latencies = hits.map((h) => Number(h.latencyMs) || 0).sort((a, b) => a - b);
            const total = latencies.length;
            const getP = (p) => {
                const idx = Math.min(Math.max(0, Math.ceil(p * total) - 1), total - 1);
                return Number(latencies[idx].toFixed(2));
            };

            const successCount = hits.filter((h) => h.statusCode < 400).length;
            const underTargetCount = latencies.filter((l) => l <= targetLatencyMs).length;

            const uptimePercentage = total > 0 ? Number(((successCount / total) * 100).toFixed(3)) : 100;
            const latencyCompliancePercentage = total > 0 ? Number(((underTargetCount / total) * 100).toFixed(2)) : 100;

            return {
                totalRequests: total,
                percentiles: {
                    p50: getP(0.50),
                    p90: getP(0.90),
                    p95: getP(0.95),
                    p99: getP(0.99),
                },
                sla: {
                    uptimePercentage,
                    targetUptime: slaTargetUptime,
                    isUptimeCompliant: uptimePercentage >= slaTargetUptime,
                    latencyCompliancePercentage,
                    targetLatencyMs,
                    isLatencyCompliant: latencyCompliancePercentage >= 95.0,
                    status: uptimePercentage >= slaTargetUptime ? 'compliant' : 'breached',
                },
            };
        } catch (error) {
            this.logger.error('Error calculating latency percentiles and SLA:', error);
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
// =====================================================================
// analyticsController.js
// Kaam: Yeh controller analytics se related saare HTTP requests handle karta hai.
// Isme stats aur dashboard data fetch karne ke liye endpoints hain.
// Reusability: Yeh controller analytics module ke andar use hota hai.
// authService aur clientRepository bhi yahan inject hote hain (DI pattern).
// =====================================================================

import ResponseFormatter from '../../../shared/utils/responseFormatter.js';
import AppError from '../../../shared/utils/AppError.js';
import logger from '../../../shared/config/logger.js';


export class AnalyticsController {
    // Constructor: DI (Dependency Injection) ke through analyticsService, authService, aur clientRepository milte hain.
    // Agar koi bhi missing ho to error throw hoga - taaki debugging asaan ho.
    constructor({ analyticsService: analyticsSvc, authService: authSvc, clientRepository: clientRepo } = {}) {
        // Require explicit dependencies to enforce DI and deterministic graphs
        if (!analyticsSvc || !authSvc || !clientRepo) {
            throw new Error('AnalyticsController requires analyticsService, authService, and clientRepository');
        }

        this.analyticsService = analyticsSvc;
        this.authService = authSvc;
        this.clientRepository = clientRepo;
    }

    // getStats: /analytics/stats route pe aata hai.
    // Query params se startTime aur endTime milte hain (optional).
    // Admin ho to kisi bhi client ke stats dekh sakta hai, normal user sirf apne client ke.
    async getStats(req, res, next) {
        try {
            const { startTime, endTime } = req.query;
            const clientId = req.user.clientId;

            // Permission check: kya user analytics dekh sakta hai?
            const isAdmin = await this.ensureCanViewAnalytics(req);
            // clientId resolve karo (admin = any, normal user = apna wala)
            const finalClientId = await this.resolveFinalClientId(req, isAdmin);
            // Time range validate karo - invalid dates pe 400 error
            const timeRange = this.validateTimeRange(startTime, endTime);

            const stats = await this.analyticsService.getOverallStats(finalClientId, timeRange)

            res.status(200).json(
                ResponseFormatter.success(stats, 'Statistics retrieved successfully', 200)

            )
        } catch (error) {
            next(error)
        }
    }

    // validateTimeRange: Query params me aaye startTime/endTime ko parse aur validate karta hai.
    // Reusable: getStats aur getDashboard dono me use hota hai.
    // Unix timestamp ya ISO string dono accept karta hai.
    validateTimeRange(startTime, endTime) {
        const parseValue = v => {
            if (v === undefined || v === null || v === '') return null;
            if (/^\d+$/.test(String(v))) return Number(v);
            const parsed = Date.parse(String(v));
            return Number.isNaN(parsed) ? NaN : parsed;
        };

        const start = parseValue(startTime);
        const end = parseValue(endTime);

        // Agar invalid date diya to 400 error
        if ((startTime && Number.isNaN(start)) || (endTime && Number.isNaN(end))) {
            throw new AppError('Invalid time format', 400);
        }

        // Start > End bhi invalid hai
        if (start !== null && end !== null && start > end) {
            throw new AppError('Invalid time range: start > end', 400);
        }

        return { startTime: start, endTime: end };
    }

    // ensureCanViewAnalytics: Permission check karta hai.
    // Super admin ho to true return, baaki users ke liye canViewAnalytics permission check.
    // Reusable: getStats aur getDashboard dono me use hota hai.
    async ensureCanViewAnalytics(req) {
        if (!req.user || !req.user.userId) {
            throw new AppError('Authentication required', 401);
        }

        // Super admin ke liye special bypass
        const isSuperAdmin = await this.authService.checkSuperAdminPermissions(req.user.userId);
        if (isSuperAdmin) return true;

        const profile = await this.authService.getProfile(req.user.userId);

        // Normal user ke pass canViewAnalytics permission honi chahiye
        if (!profile || !profile.permissions || !profile.permissions.canViewAnalytics) {
            throw new AppError('Insufficient permissions to view analytics', 403);
        }

        return false
    };

    // resolveFinalClientId: Request ke hisaab se final clientId determine karta hai.
    // Super Admin: query me clientId de sakta hai ya null (saare clients ke liye)
    // Normal User: sirf apna clientId use kar sakta hai.
    // Reusable: getStats aur getDashboard me use hota hai.
    async resolveFinalClientId(req, isSuperAdmin) {
        const queryClientId = req.query.clientId;
        const userClientId = req.user?.clientId;

        if (isSuperAdmin) {
            if (queryClientId) {
                // MongoDB ObjectId format validate karo
                if (!this.isValidObjectId(queryClientId)) {
                    throw new AppError('Invalid clientId format', 400);
                }

                const clientId = await this.clientRepository.findById(queryClientId)

                if (!clientId) throw new AppError('Client not found', 404);

                return queryClientId
            }

            // Super admin ke liye null = saare clients ka data
            return null;
        }

        // Normal user ke pass clientId honi chahiye
        if (!userClientId) {
            throw new AppError('Access denied - no client association', 403);
        }

        if (!this.isValidObjectId(userClientId)) {
            throw new AppError('Invalid client association', 400);
        }

        const client = await this.clientRepository.findById(userClientId)

        if (!client) throw new AppError('Client not found', 404);

        return userClientId;
    }

    // isValidObjectId: MongoDB ObjectId format check karta hai (24 char hex string).
    // Reusable: resolveFinalClientId me use hota hai.
    isValidObjectId(id) {
        return typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
    };

    // getDashboard: /analytics/dashboard route pe aata hai.
    // Ek saath teen cheezein fetch karta hai: stats, topEndpoints, aur timeSeries.
    // Promise.allSettled isliye use kiya taaki ek fail ho to baki ka data bhi aaye.
    async getDashboard(req, res, next) {
        try {
            const { startTime, endTime } = req.query;
            const clientId = req.user.clientId;

            const isSuperAdmin = await this.ensureCanViewAnalytics(req);
            const finalClientId = await this.resolveFinalClientId(req, isSuperAdmin);
            const timeRange = this.validateTimeRange(startTime, endTime);

            // Teen parallel calls - agar ek fail ho to bhi baki ka data milega (allSettled)
            const result = await Promise.allSettled([
                this.analyticsService.getOverallStats(finalClientId, timeRange),
                this.analyticsService.getTopEndpoints(finalClientId, { limit: null, startTime: timeRange.startTime }),
                this.analyticsService.getTimeSeries(finalClientId, { ...timeRange, limit: 24 }),
            ]);

            // Fulfilled ho to value lo, rejected ho to null
            const [stats, topEndpoints, recentTimeSeries] = result.map((item) => item.status === "fulfilled" ? item.value : null)

            const dashboard = {
                stats,
                topEndpoints,
                recentActitivy: recentTimeSeries
            }

            res.status(200).json(
                ResponseFormatter.success(dashboard, "Dashboard data retrieved successfully", 200)
            )
        } catch (error) {
            next(error)
        }
    }

    async getEndpointDetails(req, res, next) {
        try {
            const { endpoint, serviceName, method, startTime, endTime } = req.query;
            if (!endpoint || !serviceName || !method) {
                throw new AppError('endpoint, serviceName, and method are required', 400);
            }

            const isSuperAdmin = await this.ensureCanViewAnalytics(req);
            const clientId = await this.resolveFinalClientId(req, isSuperAdmin);
            if (!clientId) throw new AppError('Select a client before viewing endpoint details', 400);

            const timeRange = this.validateTimeRange(startTime, endTime);
            const details = await this.analyticsService.getEndpointDetails({
                clientId,
                serviceName,
                endpoint,
                method,
                startTime: timeRange.startTime ? new Date(timeRange.startTime) : null,
                endTime: timeRange.endTime ? new Date(timeRange.endTime) : null,
            });

            res.status(200).json(ResponseFormatter.success(details, 'Endpoint details retrieved successfully', 200));
        } catch (error) {
            next(error);
        }
    }
}
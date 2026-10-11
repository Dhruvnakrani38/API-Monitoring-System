import AppError from '../../../shared/utils/AppError.js';
import ResponseFormatter from '../../../shared/utils/responseFormatter.js';

export class JourneyController {
    constructor({ journeyService, authService, clientRepository }) {
        this.journeyService = journeyService;
        this.authService = authService;
        this.clientRepository = clientRepository;
    }

    async resolveClientId(req, required = false) {
        const isSuperAdmin = await this.authService.checkSuperAdminPermissions(req.user.userId);
        const requested = req.query.clientId || req.body?.clientId;
        const clientId = isSuperAdmin ? requested : req.user.clientId;
        if (required && !clientId) throw new AppError('clientId is required', 400);
        if (!clientId) return { clientId: null, isSuperAdmin };
        if (!/^[0-9a-fA-F]{24}$/.test(clientId)) throw new AppError('Invalid clientId format', 400);
        return { clientId, isSuperAdmin };
    }

    canManage(req, isSuperAdmin) {
        if (!isSuperAdmin && req.user.role !== 'client_admin') {
            throw new AppError('Journey management requires admin access', 403);
        }
    }

    async list(req, res, next) {
        try {
            const { clientId } = await this.resolveClientId(req);
            res.json(ResponseFormatter.success(await this.journeyService.list(clientId), 'Journeys retrieved'));
        } catch (err) { next(err); }
    }

    async getById(req, res, next) {
        try {
            const { clientId } = await this.resolveClientId(req);
            const journey = await this.journeyService.getById(req.params.id, clientId);
            if (!journey) throw new AppError('Journey not found', 404);
            res.json(ResponseFormatter.success(journey, 'Journey retrieved'));
        } catch (err) { next(err); }
    }

    async create(req, res, next) {
        try {
            const scope = await this.resolveClientId(req, true);
            this.canManage(req, scope.isSuperAdmin);
            const journey = await this.journeyService.create(scope.clientId, req.body, req.user.userId);
            res.status(201).json(ResponseFormatter.success(journey, 'Journey created', 201));
        } catch (err) { next(err); }
    }

    async remove(req, res, next) {
        try {
            const scope = await this.resolveClientId(req, true);
            this.canManage(req, scope.isSuperAdmin);
            const deleted = await this.journeyService.remove(req.params.id, scope.clientId);
            if (!deleted) throw new AppError('Journey not found', 404);
            res.json(ResponseFormatter.success(null, 'Journey deleted'));
        } catch (err) { next(err); }
    }

    async runs(req, res, next) {
        try {
            const { clientId } = await this.resolveClientId(req);
            res.json(ResponseFormatter.success(await this.journeyService.runs(req.params.id, clientId), 'Journey runs retrieved'));
        } catch (err) { next(err); }
    }

    async triggerRun(req, res, next) {
        try {
            const { clientId } = await this.resolveClientId(req);
            const result = await this.journeyService.runJourney(req.params.id, clientId);
            res.json(ResponseFormatter.success(result, result.success ? 'Journey completed successfully' : 'Journey failed'));
        } catch (err) { next(err); }
    }
}

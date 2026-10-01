import AppError from '../../../shared/utils/AppError.js';
import ResponseFormatter from '../../../shared/utils/responseFormatter.js';

export class AlertController {
    constructor({ alertService, authService, clientRepository }) {
        this.alertService = alertService;
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
        if (isSuperAdmin && requested && !(await this.clientRepository.findById(clientId))) throw new AppError('Client not found', 404);
        return { clientId, isSuperAdmin };
    }

    canManage(req, isSuperAdmin) {
        if (!isSuperAdmin && req.user.role !== 'client_admin') throw new AppError('Alert management requires admin access', 403);
    }

    async listRules(req, res, next) {
        try { const { clientId } = await this.resolveClientId(req); res.json(ResponseFormatter.success(await this.alertService.listRules(clientId), 'Alert rules retrieved')); } catch (error) { next(error); }
    }

    async createRule(req, res, next) {
        try { const scope = await this.resolveClientId(req, true); this.canManage(req, scope.isSuperAdmin); res.status(201).json(ResponseFormatter.success(await this.alertService.createRule(scope.clientId, req.body, req.user.userId), 'Alert rule created', 201)); } catch (error) { next(error); }
    }

    async updateRule(req, res, next) {
        try { const scope = await this.resolveClientId(req, true); this.canManage(req, scope.isSuperAdmin); const rule = await this.alertService.updateRule(req.params.id, scope.clientId, req.body); if (!rule) throw new AppError('Alert rule not found', 404); res.json(ResponseFormatter.success(rule, 'Alert rule updated')); } catch (error) { next(error); }
    }

    async deleteRule(req, res, next) {
        try { const scope = await this.resolveClientId(req, true); this.canManage(req, scope.isSuperAdmin); const deleted = await this.alertService.deleteRule(req.params.id, scope.clientId); if (!deleted) throw new AppError('Alert rule not found', 404); res.json(ResponseFormatter.success(null, 'Alert rule deleted')); } catch (error) { next(error); }
    }

    async listIncidents(req, res, next) {
        try { const { clientId } = await this.resolveClientId(req); res.json(ResponseFormatter.success(await this.alertService.listIncidents(clientId, req.query.status), 'Alert incidents retrieved')); } catch (error) { next(error); }
    }
}
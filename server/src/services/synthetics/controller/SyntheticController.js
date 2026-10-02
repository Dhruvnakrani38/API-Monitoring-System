import AppError from '../../../shared/utils/AppError.js';
import ResponseFormatter from '../../../shared/utils/responseFormatter.js';

export class SyntheticController {
    constructor({ service, authService, clientRepository }) { this.service = service; this.authService = authService; this.clientRepository = clientRepository; }

    async scope(req, required = false) {
        const superAdmin = await this.authService.checkSuperAdminPermissions(req.user.userId);
        const requested = req.query.clientId || req.body?.clientId;

        // Non-super-admin: always scope to their own clientId (never null)
        const clientId = superAdmin
            ? (requested || null)
            : (req.user.clientId ? String(req.user.clientId) : null);

        // For non-super-admin: clientId is ALWAYS required (they must belong to a client)
        if (!superAdmin && !clientId) throw new AppError('No client associated with your account', 403);
        if (required && !clientId) throw new AppError('clientId is required', 400);
        if (!clientId) return { clientId: null, superAdmin };
        if (!/^[0-9a-fA-F]{24}$/.test(clientId)) throw new AppError('Invalid clientId format', 400);
        if (superAdmin && requested && !(await this.clientRepository.findById(clientId))) throw new AppError('Client not found', 404);
        return { clientId: String(clientId), superAdmin };
    }

    manage(req, superAdmin) { if (!superAdmin && req.user.role !== 'client_admin') throw new AppError('Synthetic checks require admin access', 403); }

    // list: non-super-admin always scoped to their own client (required=true for them via scope())
    async list(req, res, next) { try { const scope = await this.scope(req, false); res.json(ResponseFormatter.success(await this.service.list(scope.clientId), 'Synthetic checks retrieved')); } catch (error) { next(error); } }
    async create(req, res, next) { try { const scope = await this.scope(req, true); this.manage(req, scope.superAdmin); res.status(201).json(ResponseFormatter.success(await this.service.create(scope.clientId, req.body, req.user.userId), 'Synthetic check created', 201)); } catch (error) { next(error); } }
    async remove(req, res, next) { try { const scope = await this.scope(req, false); this.manage(req, scope.superAdmin); if (!await this.service.remove(req.params.id, scope.clientId)) throw new AppError('Synthetic check not found', 404); res.json(ResponseFormatter.success(null, 'Synthetic check deleted')); } catch (error) { next(error); } }
    async runs(req, res, next) { try { const scope = await this.scope(req, false); res.json(ResponseFormatter.success(await this.service.runs(req.params.id, scope.clientId), 'Synthetic check runs retrieved')); } catch (error) { next(error); } }
    async triggerAll(req, res, next) { try { const scope = await this.scope(req, false); res.json(ResponseFormatter.success(await this.service.runAll(scope.clientId), 'Synthetic check verification trigger completed')); } catch (error) { next(error); } }
}
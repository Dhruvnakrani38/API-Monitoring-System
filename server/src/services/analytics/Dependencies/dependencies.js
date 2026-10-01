// =====================================================================
// analytics/Dependencies/dependencies.js
// Kaam: Analytics module ka Dependency Injection (DI) container.
// Yahan saari dependencies ek jagah initialize hoti hain:
//   - Repositories (clientRepository, metricsRepository)
//   - Services (analyticsService, authService)
//   - Controllers (analyticsController)
// Reusability: analyticsRoutes.js yahan se analyticsController import karta hai.
// =====================================================================

import clientRepository from '../../client/repository/ClientRepository.js';
import processorContainer from '../../processor/Dependencies/dependencies.js';
import authContainer from '../../auth/Dependencies/dependencies.js';

import { AnalyticsService } from '../services/analyticsService.js';
import { AnalyticsController } from '../controller/analyticsController.js';

/**
 * Container class - DI pattern follow karta hai.
 * init() static method se ek baar sab initialize hota hai.
 * Export hua object singleton hai - puri application me ek hi instance.
 */
class Container {
    static init() {
        // Repositories: database se data fetch karne ke liye
        const repositories = {
            clientRepository,                                                    // Client (MongoDB)
            metricsRepository: processorContainer.repositories.metricsRepository, // Metrics (PostgreSQL)
        };

        // analyticsService: business logic, metricsRepository ke saath
        const analyticsService = new AnalyticsService(repositories.metricsRepository, repositories.apiHitRepository);

        // Services: authService processor container se aata hai (already initialized)
        const services = {
            analyticsService,
            authService: authContainer.services && authContainer.services.authService,
        };

        // analyticsController: teen dependencies inject hoti hain
        const analyticsController = new AnalyticsController({
            analyticsService: services.analyticsService,
            authService: services.authService,
            clientRepository: repositories.clientRepository,
        });

        const controllers = {
            analyticsController,
        };

        return { repositories, services, controllers };
    }
}

// Ek baar init karo, baad me same object reuse hoga
const initialized = Container.init();
export { Container };
export default initialized;

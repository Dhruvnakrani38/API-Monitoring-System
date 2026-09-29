import { AuthController } from "../controller/authController.js";
import { AuthService } from "../service/authService.js";
import MongoUserRepository from "../repository/UserRepository.js"
import { ClientService } from "../../client/services/clientService.js"
import MongoClientRepository from "../../client/repository/ClientRepository.js"
import MongoApiKeyRepository from "../../client/repository/ApiKeyRepository.js"

/**
 * Dependency Injection Container for the Auth module.
 * This container initializes and manages the dependencies for the Auth module,
 * including repositories, services, and controllers.
 */
class Container {
    static init() {
        // Initialize repositories
        const repositories = {
            userRepository: MongoUserRepository
        };

        // Initialize client service dependencies
        const clientRepositories = {
            clientRepository: MongoClientRepository,
            apiKeyRepository: MongoApiKeyRepository,
            userRepository: MongoUserRepository // Use the same user repository
        };

        const clientService = new ClientService(clientRepositories);

        // Initialize services with their respective repositories
        const services = {
            authService: new AuthService(repositories.userRepository),
            clientService: clientService
        };

        // Initialize controllers with their respective services
        const controller = {
            authController: new AuthController(services.authService, services.clientService)
        }

        return {
            repositories, services, controller
        }
    }
}

const initialized = Container.init();
export { Container };
export default initialized
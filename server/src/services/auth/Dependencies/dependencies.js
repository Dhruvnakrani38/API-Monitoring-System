// =====================================================================
// auth/Dependencies/dependencies.js
// Kaam: Auth module ka Dependency Injection (DI) container.
// Yahan repositories, services, aur controllers initialize hote hain.
// Note: clientService bhi yahan inject hoti hai kyunki approveUser me
//       client + API key banana hota hai.
// Reusability: authRouter.js aur analytics/dependencies.js yahan se import karte hain.
// =====================================================================

import { AuthController } from "../controller/authController.js";
import { AuthService } from "../service/authService.js";
import MongoUserRepository from "../repository/UserRepository.js"
import { ClientService } from "../../client/services/clientService.js"
import MongoClientRepository from "../../client/repository/ClientRepository.js"
import MongoApiKeyRepository from "../../client/repository/ApiKeyRepository.js"

/**
 * Container: Auth module ki saari dependencies ek jagah initialize karta hai.
 * init() static method singleton pattern follow karta hai.
 * Exported object ko directly authRouter.js use karta hai.
 */
class Container {
    static init() {
        // ---- Repositories (Database Layer) ----
        const repositories = {
            userRepository: MongoUserRepository   // User CRUD ke liye MongoDB repository
        };

        // ---- Client Service Dependencies ----
        // approveUser me naya client aur API key banana padta hai
        // isliye clientService bhi yahan initialize kar rahe hain
        const clientRepositories = {
            clientRepository: MongoClientRepository,   // Client CRUD
            apiKeyRepository: MongoApiKeyRepository,   // API Key CRUD
            userRepository: MongoUserRepository        // Same user repository (shared)
        };

        // ClientService: approve flow me clientRepository + apiKeyRepository use karta hai
        const clientService = new ClientService(clientRepositories);

        // ---- Services (Business Logic Layer) ----
        const services = {
            authService: new AuthService(repositories.userRepository),  // Auth logic
            clientService: clientService                                 // Client/key creation
        };

        // ---- Controllers (HTTP Layer) ----
        // authController ko authService aur clientService dono chahiye
        const controller = {
            authController: new AuthController(services.authService, services.clientService)
        }

        return {
            repositories, services, controller
        }
    }
}

// Ek baar initialize karo - singleton pattern
const initialized = Container.init();
export { Container };
export default initialized
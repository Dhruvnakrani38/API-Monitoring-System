// =====================================================================
// auth/repository/BaseRepository.js
// Kaam: Abstract base class jo auth module ke repositories ke liye
//       common interface define karta hai.
// Design Pattern: Template Method Pattern - subclasses ko override karna padega.
// Reusability: MongoUserRepository is class ko extend karta hai.
// =====================================================================

/**
 * BaseRepository - Auth module ke repositories ka abstract base class.
 * Yeh class directly use nahi hoti - sirf extend ki jaati hai.
 * Har method "Method not implemented" error throw karta hai
 * taaki subclass ko override karne ki yaad dilaye.
 */
export default class BaseRepository {
    // Constructor: Mongoose model yahan store hoti hai
    constructor(model) {
        this.model = model;
    }

    // create: Naya user/record banana (subclass implement karega)
    async create(data) {
        throw new Error("Method not implemented")
    };

    // findById: ID se record dhundhna (subclass implement karega)
    async findById(id) {
        throw new Error('Method not implemented');
    }

    // findByUsername: Username se user dhundhna (subclass implement karega)
    async findByUsername(username) {
        throw new Error('Method not implemented');
    }

    // findByEmail: Email se user dhundhna (subclass implement karega)
    async findByEmail(email) {
        throw new Error('Method not implemented');
    }

    // findAll: Saare records dhundhna (subclass implement karega)
    async findAll() {
        throw new Error('Method not implemented');
    }
}
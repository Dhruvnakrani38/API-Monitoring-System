// =====================================================================
// UserRepository.js
// Kaam: MongoDB me User collection ke saare database operations yahan hote hain.
// BaseRepository extend karta hai aur Mongoose se actual DB calls karta hai.
// Reusability: authService, clientService, aur auth dependencies me use hota hai.
// =====================================================================

import BaseRepository from "./BaseRepository.js";
import User from "../../../shared/models/User.js"
import logger from "../../../shared/config/logger.js"

/**
 * MongoUserRepository: User collection ke liye MongoDB implementation.
 * create, findById, findByUsername, findByEmail, findAll ke saath
 * extra methods: findByApprovalStatus, update, updateSafe.
 */
class MongoUserRepository extends BaseRepository {
    // Constructor: User model inject karta hai BaseRepository me
    constructor() {
        super(User)
    }


    /**
     * create: Naya user MongoDB me save karta hai.
     * Agar role 'super_admin' hai to automatically saari permissions set hoti hain.
     * Reusability: authService.register, clientService.createClientUser, aur
     *              authService.publicSignup me use hota hai.
     */
    async create(userData) {
        try {
            let data = { ...userData }
            // Super admin ke liye automatically saari permissions enable karo
            if (data.role === "super_admin" && !data.permissions) {
                data.permissions = {
                    canCreateApiKeys: true,
                    canManageUsers: true,
                    canViewAnalytics: true,
                    canExportData: true,
                }
            }

            // Mongoose model instance banao aur save karo
            const user = new this.model(data);
            await user.save();

            logger.info("User created", { username: user.username });
            return user
        } catch (error) {
            logger.error("Error creating user", error)
            throw error;
        }
    }

    /**
     * findById: User ko MongoDB _id se dhundhta hai.
     * Reusability: authService.getProfile, approveUser, rejectUser me use hota hai.
     */
    async findById(userId) {
        try {
            const user = await this.model.findById(userId)
            return user
        } catch (error) {
            logger.error("Error finding user by id", error)
            throw error;
        }
    }

    /**
     * findByUsername: Login ke time username se user dhundhta hai.
     * Reusability: authService.login me use hota hai.
     */
    async findByUsername(username) {
        try {
            const user = await this.model.findOne({ username })
            return user
        } catch (error) {
            logger.error("Error finding user by username", error)
            throw error;
        }
    }

    /**
     * findByEmail: Email se user dhundhna (duplicate check ke liye bhi).
     * Reusability: authService me signup ke waqt duplicate email check me.
     */
    async findByEmail(email) {
        try {
            const user = await this.model.findOne({ email })
            return user
        } catch (error) {
            logger.error("Error finding user by email", error)
            throw error;
        }
    }

    /**
     * findAll: Saare active users dhundho (password exclude karke).
     * Reusability: Admin user management pages ke liye.
     */
    async findAll() {
        try {
            // isActive: true filter - inactive users nahi chahiye
            // .select("-password") - password field return mat karo (security)
            const user = await this.model.find({ isActive: true }).select("-password")
            return user
        } catch (error) {
            logger.error("Error finding user by email", error)
            throw error;
        }
    }

    /**
     * findByApprovalStatus: Approval status ke hisaab se users dhundhna.
     * status: 'pending' | 'approved' | 'rejected'
     * Reusability: authService.getPendingUsers me use hota hai.
     */
    async findByApprovalStatus(status) {
        try {
            const users = await this.model.find({ approvalStatus: status }).select("-password")
            return users
        } catch (error) {
            logger.error("Error finding users by approval status", error)
            throw error;
        }
    }

    async findByClientId(clientId) {
        try {
            return await this.model.find({ clientId, isActive: true }).select("-password");
        } catch (error) {
            logger.error("Error finding users by client", error);
            throw error;
        }
    }

    /**
     * update: User ko ID se update karta hai (password bhi return ho sakta hai).
     * Warning: Yeh password bhi return karta hai - sensitive data ke liye updateSafe use karo.
     */
    async update(userId, updateData) {
        try {
            // { new: true } = updated document return karo, purana nahi
            const user = await this.model.findByIdAndUpdate(userId, updateData, { new: true })
            return user
        } catch (error) {
            logger.error("Error updating user", error)
            throw error;
        }
    }

    /**
     * updateSafe: User update karo lekin password field return mat karo.
     * Reusability: approveUser aur rejectUser me use hota hai - safe response ke liye.
     */
    async updateSafe(userId, updateData) {
        try {
            // .select("-password") = response me password field nahi aayega
            const user = await this.model.findByIdAndUpdate(userId, updateData, { new: true }).select("-password")
            return user
        } catch (error) {
            logger.error("Error updating user safely", error)
            throw error;
        }
    }
}

// Singleton export - puri app me ek hi instance use hoga
export default new MongoUserRepository()
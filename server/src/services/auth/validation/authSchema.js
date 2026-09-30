// =====================================================================
// authSchema.js
// Kaam: Auth module ke liye request body validation schemas define karta hai.
// validate() middleware in schemas ko use karta hai fields validate karne ke liye.
// Reusability: authRouter.js me validate(schema) middleware ke saath use hota hai.
// =====================================================================

import { isValidRole } from "../../../shared/constants/roles.js";

/**
 * onboardSuperAdminSchema: Super admin onboarding ke liye validation rules.
 * username, email, password - teeno required hain.
 * password: minimum 6 characters.
 */
export const onboardSuperAdminSchema = {
    username: {
        required: true,   // Username must hona chahiye
    },
    email: {
        required: true,   // Email must hona chahiye
    },
    password: {
        required: true,   // Password must hona chahiye
        minLength: 6      // Kam se kam 6 characters
    }
}

/**
 * registrationSchema: User registration aur public signup ke liye.
 * username, email, password required; role optional.
 * role validation: isValidRole function se check hota hai ki valid role hai ya nahi.
 * Reusability: /register aur /signup dono routes me use hota hai.
 */
export const registrationSchema = {
    username: {
        required: true,
    },
    email: {
        required: true,
    },
    password: {
        required: true,
        minLength: 6
    },
    role: {
        required: false,  // Role optional hai - default 'client_viewer' hoga
        custom: (value) => {
            // Agar role diya gaya hai to valid hona chahiye
            if (!value) return null;
            return isValidRole(value) ? null : 'Invalid role'; // null = no error
        }
    },
}

/**
 * loginSchema: Login ke liye validation rules.
 * username aur password dono required hain.
 */
export const loginSchema = {
    username: { required: true },
    password: { required: true },
};
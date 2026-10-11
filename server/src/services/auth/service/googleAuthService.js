import logger from '../../../shared/config/logger.js';
import AppError from '../../../shared/utils/AppError.js';
import config from '../../../shared/config/index.js';
import jwt from 'jsonwebtoken';

/**
 * GoogleAuthService
 * Kaam: Google OAuth callback pe user find-or-create karta hai aur JWT mint karta hai.
 * Flow: Google callback → findByEmail → if exists, login; else create pending user (auto-approved for OAuth)
 */
export class GoogleAuthService {
    constructor(userRepository) {
        if (!userRepository) throw new Error('UserRepository is required for GoogleAuthService');
        this.userRepository = userRepository;
    }

    generateToken(user) {
        const payload = {
            userId: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
            clientId: user.clientId,
        };
        return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
    }

    /**
     * Handle Google profile callback.
     * If user exists → log them in.
     * If new user → create with pending approval (they still need admin approval for client access).
     */
    async handleGoogleProfile({ googleId, email, displayName, avatarUrl }) {
        try {
            // Try to find existing user by email
            let user = await this.userRepository.findByEmail(email);

            if (user) {
                // Check account is active
                if (!user.isActive) {
                    throw new AppError('Account is deactivated. Contact support.', 403);
                }
                // Update googleId if not yet stored
                if (!user.googleId) {
                    user = await this.userRepository.updateSafe(user._id, {
                        googleId,
                        avatarUrl: avatarUrl || user.avatarUrl,
                        authProvider: 'google',
                    });
                }
            } else {
                // New user via Google — create with pending status
                // Username derived from email prefix; ensure uniqueness
                let baseUsername = email.split('@')[0].replace(/[^a-zA-Z0-9_.-]/g, '_');
                let username = baseUsername;
                let attempt = 0;
                while (await this.userRepository.findByUsername(username)) {
                    attempt++;
                    username = `${baseUsername}_${attempt}`;
                }

                // Create user without password (OAuth-only account)
                user = await this.userRepository.createOAuthUser({
                    username,
                    email,
                    displayName,
                    googleId,
                    avatarUrl,
                    authProvider: 'google',
                    role: 'client_viewer',
                    isApproved: false,
                    approvalStatus: 'pending',
                    isActive: false, // Requires admin approval
                });

                logger.info('New Google OAuth user created — pending admin approval', { email, username });
            }

            // For approved + active users, mint token
            if (!user.isApproved || user.approvalStatus !== 'approved') {
                // Return user but signal "pending" — frontend will show pending message
                return { user, pending: true, token: null };
            }

            const token = this.generateToken(user);
            logger.info('Google OAuth login successful', { email: user.email, userId: user._id });
            return { user, pending: false, token };
        } catch (error) {
            logger.error('Google OAuth error', error);
            throw error;
        }
    }
}

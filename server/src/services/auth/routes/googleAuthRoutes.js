/**
 * Google OAuth Routes
 * ─────────────────────────────────────────────────────────────────────────
 * Two routes:
 *   GET /api/auth/google          — Redirect user to Google consent screen
 *   GET /api/auth/google/callback — Google redirects here after user grants access
 *
 * Strategy: We use the standard passport-google-oauth20 passport strategy,
 * but since this project uses ES Modules + stateless JWT cookies (no sessions),
 * we wire up the strategy manually without passport's session serialization.
 *
 * Flow:
 *   1. Frontend: window.location = '/api/auth/google'
 *   2. Backend:  Redirect to Google.
 *   3. Google:   Redirects to /api/auth/google/callback?code=...
 *   4. Backend:  Exchange code for tokens, get profile, call GoogleAuthService.
 *   5. Backend:  Set httpOnly authToken cookie, redirect to /?google_auth=1
 *   6. Frontend: App re-fetches /auth/profile, sees authenticated user.
 */
import express from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import config from '../../../shared/config/index.js';
import logger from '../../../shared/config/logger.js';
import MongoUserRepository from '../repository/UserRepository.js';
import { GoogleAuthService } from '../service/googleAuthService.js';

const router = express.Router();

const googleAuthService = new GoogleAuthService(MongoUserRepository);

// ── Strategy Setup ────────────────────────────────────────────────────────
// Only register if credentials exist (avoid startup crash in environments where
// Google OAuth is not configured)
const GOOGLE_CLIENT_ID = config.google?.clientId || process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = config.google?.clientSecret || process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_CALLBACK_URL = config.google?.callbackUrl ||
    process.env.GOOGLE_CALLBACK_URL ||
    `${process.env.SERVER_BASE_URL || 'http://localhost:5000'}/api/auth/google/callback`;

const FRONTEND_URL = process.env.FRONTEND_URL || process.env.DASHBOARD_URL || 'http://localhost:5173';

const googleEnabled = Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);

if (googleEnabled) {
    passport.use('google', new GoogleStrategy(
        {
            clientID: GOOGLE_CLIENT_ID,
            clientSecret: GOOGLE_CLIENT_SECRET,
            callbackURL: GOOGLE_CALLBACK_URL,
            scope: ['profile', 'email'],
        },
        // Verify callback — we do everything in our service
        async (accessToken, refreshToken, profile, done) => {
            try {
                const email = profile.emails?.[0]?.value;
                if (!email) return done(new Error('No email returned from Google profile'));

                const result = await googleAuthService.handleGoogleProfile({
                    googleId: profile.id,
                    email,
                    displayName: profile.displayName,
                    avatarUrl: profile.photos?.[0]?.value || null,
                });
                return done(null, result);
            } catch (err) {
                return done(err);
            }
        }
    ));

    // Use passport without sessions (stateless JWT)
    passport.serializeUser((user, done) => done(null, user));
    passport.deserializeUser((user, done) => done(null, user));
}

const ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'https://api-monitoring-system-six.vercel.app',
];

const resolveFrontendOrigin = (targetUrl) => {
    if (!targetUrl) return process.env.FRONTEND_URL || 'https://api-monitoring-system-six.vercel.app';
    try {
        const parsed = new URL(targetUrl);
        const origin = parsed.origin;
        if (ALLOWED_ORIGINS.includes(origin)) return origin;
    } catch {
        // invalid URL string, ignore
    }
    return process.env.FRONTEND_URL || 'https://api-monitoring-system-six.vercel.app';
};

// ── Route: Initiate Google Login ─────────────────────────────────────────
router.get('/', (req, res, next) => {
    if (!googleEnabled) {
        return res.status(503).json({ success: false, message: 'Google OAuth is not configured on this server. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.' });
    }
    const candidateReturnTo = req.query.return_to || req.headers.referer;
    const frontendTarget = resolveFrontendOrigin(candidateReturnTo);
    passport.authenticate('google', {
        scope: ['profile', 'email'],
        state: frontendTarget,
        session: false,
    })(req, res, next);
});

// ── Route: Google Callback ────────────────────────────────────────────────
router.get('/callback', (req, res, next) => {
    const frontendTarget = resolveFrontendOrigin(req.query.state);

    if (!googleEnabled) {
        return res.redirect(`${frontendTarget}/?google_error=not_configured`);
    }

    passport.authenticate('google', { session: false, failWithError: true }, async (err, result) => {
        if (err || !result) {
            logger.error('Google OAuth callback error', err);
            return res.redirect(`${frontendTarget}/?google_error=${encodeURIComponent(err?.message || 'oauth_failed')}`);
        }

        const { user, pending, token } = result;

        if (pending || !token) {
            // New user — requires admin approval
            return res.redirect(`${frontendTarget}/?google_pending=1&email=${encodeURIComponent(user.email)}`);
        }

        // Set httpOnly JWT cookie (same settings as regular login)
        res.cookie('authToken', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        logger.info('Google OAuth login complete, redirecting to dashboard', { userId: user._id });
        return res.redirect(`${frontendTarget}/?google_auth=success`);
    })(req, res, next);
});

export { googleEnabled };
export default router;

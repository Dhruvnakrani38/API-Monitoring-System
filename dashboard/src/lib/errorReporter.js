const isDev = import.meta.env.DEV;
const endpoint = import.meta.env.VITE_ERROR_REPORT_URL ?? null;

// Ye function error ko development console ya configured production endpoint par bhejta hai.
export function reportError(error, context = {}) {
    // Development mode mein network report ki jagah details console par rakho.
    if (isDev) {
        console.error('[ErrorReporter]', error, context);
        return;
    }

    // Endpoint configured na ho to report bhejne ki koshish mat karo.
    if (!endpoint) return;

    // Error details aur browser context ko beacon payload mein jama karo.
    const payload = {
        message: error?.message ?? String(error),
        stack: error?.stack ?? null,
        context,
        url: window.location.href,
        timestamp: new Date().toISOString(),
    };

    navigator.sendBeacon(endpoint, JSON.stringify(payload));
}

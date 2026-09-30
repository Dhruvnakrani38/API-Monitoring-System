const axios = require('axios');
const http = require('http');
const https = require('https');
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 512 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 512 });
const deliveryStats = { attempted: 0, accepted: 0, failed: 0, inFlight: 0, peakInFlight: 0, outcomes: {} };

const statsReporter = setInterval(() => {
    if (deliveryStats.attempted === 0) return;
    console.log('[PulseWatch delivery]', JSON.stringify({ ...deliveryStats }));
    deliveryStats.attempted = 0;
    deliveryStats.accepted = 0;
    deliveryStats.failed = 0;
    deliveryStats.peakInFlight = deliveryStats.inFlight;
    deliveryStats.outcomes = {};
}, 5000);
statsReporter.unref();

/**
 * Monitoring middleware for API performance tracking
 * Reusable across different client applications
 */
const monitoringMiddleware = (options = {}) => {
    const {
        apiKey = process.env.PULSEWATCH_API_KEY || process.env.MONITORING_API_KEY,
        endpoint = process.env.PULSEWATCH_URL
            ? `${process.env.PULSEWATCH_URL.replace(/\/$/, '')}/api/hit`
            : process.env.MONITORING_ENDPOINT || 'http://localhost:5000/api/hit',
        serviceName = process.env.SERVICE_NAME || 'my-service',
        enableLogging = process.env.MONITORING_LOGGING === 'true',
        timeout = Number(process.env.PULSEWATCH_TIMEOUT_MS || 15000),
        enabled = process.env.MONITORING_ENABLED !== 'false'
    } = options;

    // If monitoring is disabled or no API key, return pass-through middleware
    if (!enabled || !apiKey) {
        if (enableLogging && !apiKey) {
            console.warn('PulseWatch monitoring disabled: set PULSEWATCH_API_KEY');
        }
        return (req, res, next) => next();
    }

    return (req, res, next) => {
        const startTime = Date.now();

        // Capture the original response end function
        const originalEnd = res.end;

        res.end = function (...args) {
            const endTime = Date.now();
            const responseTime = endTime - startTime;

            // Prepare monitoring data
            const monitoringData = {
                serviceName: serviceName,
                endpoint: req.originalUrl || req.url,
                method: req.method,
                statusCode: res.statusCode,
                latencyMs: responseTime,
                ip: req.ip || req.connection?.remoteAddress || 'unknown',
                userAgent: req.get('User-Agent') || 'unknown'
            };

            // Send monitoring data asynchronously (don't block response)
            setImmediate(() => {
                sendMonitoringData(monitoringData, { apiKey, endpoint, enableLogging, timeout });
            });

            // Call original end function
            originalEnd.apply(res, args);
        };

        next();
    };
};

async function sendMonitoringData(data, options) {
    deliveryStats.attempted += 1;
    deliveryStats.inFlight += 1;
    deliveryStats.peakInFlight = Math.max(deliveryStats.peakInFlight, deliveryStats.inFlight);

    try {
        if (options.enableLogging) {
            console.log('Sending monitoring data:', {
                endpoint: data.endpoint,
                method: data.method,
                statusCode: data.statusCode,
                latencyMs: data.latencyMs
            });
        }

        const response = await axios.post(options.endpoint, data, {
            headers: {
                'x-api-key': options.apiKey,
                'Content-Type': 'application/json'
            },
            timeout: options.timeout,
            httpAgent,
            httpsAgent,
        });
        deliveryStats.accepted += response.status >= 200 && response.status < 300 ? 1 : 0;
        const outcome = String(response.status);
        deliveryStats.outcomes[outcome] = (deliveryStats.outcomes[outcome] || 0) + 1;

        if (options.enableLogging) {
            console.log('Monitoring data sent successfully');
        }
    } catch (error) {
        deliveryStats.failed += 1;
        const outcome = String(error.response?.status || error.code || error.message);
        deliveryStats.outcomes[outcome] = (deliveryStats.outcomes[outcome] || 0) + 1;
        // Fail silently to not disrupt the main application
        if (options.enableLogging) {
            if (error.response) {
                console.error('Failed to send monitoring data:', error.response.status, error.response.data?.message || error.response.statusText);
            } else {
                console.error('Failed to send monitoring data:', error.message);
            }
        }
    } finally {
        deliveryStats.inFlight -= 1;
    }
}

module.exports = monitoringMiddleware;
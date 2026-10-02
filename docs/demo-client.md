# Demo client and monitoring integration

This repository includes a demo application under `demo/code_architecture/` to show how a real service integrates with PulseWatch.

## 1. Purpose

The demo app demonstrates how a monitored API should:

- expose normal business routes
- include a monitoring middleware
- collect response time and exit status
- send that data to the PulseWatch ingest endpoint
- remain fast without waiting for complex processing

## 2. Files in the demo

Key files:

- `demo/code_architecture/server.js` — sample API server
- `demo/code_architecture/monitoring.js` — reusable monitoring middleware
- `demo/code_architecture/load-test.js` — traffic generator
- `demo/code_architecture/README.md` — demo usage instructions

## 3. Monitoring middleware

The middleware in `monitoring.js` does the following:

- reads values from environment variables such as `PULSEWATCH_API_KEY`
- hooks into `res.end()`
- captures method, endpoint, status code, and latency
- sends an async POST request to `${PULSEWATCH_URL}/api/hit`
- uses the `x-api-key` header for authentication
- fails silently if the monitoring call cannot complete

This is designed so that the monitored app does not block on telemetry delivery.

## 4. Required environment variables

Create a server-side `.env` file for the demo service:

```env
PULSEWATCH_URL=http://localhost:5000
PULSEWATCH_API_KEY=your_api_key_here
PULSEWATCH_SERVICE_NAME=demo-api
PORT=3002
MONITORING_ENABLED=true
```

Important: keep API keys server-side. Do not place them in the browser or frontend code.

## 5. How the demo app works

1. The app receives a request on a route such as `/api/posts`.
2. The middleware records the start timestamp.
3. The response is completed normally.
4. The middleware posts the metric payload to the backend ingest endpoint.
5. PulseWatch validates the API key and queues the hit for processing.

## 6. Local run steps

```bash
cd demo/code_architecture
npm install
npm start
```

Then open a sample route such as:

```bash
curl http://localhost:3002/api/posts
```

## 7. Load testing

The demo includes a load test script. Example:

```powershell
$env:LOAD_RPS = '1000'
$env:LOAD_DURATION_SECONDS = '10'
npm run load
```

This sends traffic to the demo API and validates that monitoring requests are accepted by the backend.

## 8. Typical data produced

Each monitor hit includes fields like:

- `serviceName`
- `endpoint`
- `method`
- `statusCode`
- `latencyMs`
- `ip`
- `userAgent`

## 9. Integration guidance for your own app

Use the pattern in `monitoring.js` as a template for any Node.js service you want to monitor:

- add middleware near your HTTP server
- capture response metadata
- send the notification asynchronously
- use a service-specific API key
- avoid blocking the response flow on telemetry

## 10. Notes

The demo app is intentionally small, but it demonstrates the real production pattern used by PulseWatch: asynchronous instrumentation with a secure API key and background queue processing.

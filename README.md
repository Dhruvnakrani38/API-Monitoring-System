# PulseWatch API Monitoring System

PulseWatch is a full-stack API observability platform for collecting, processing, and visualizing API metrics in real time. It tracks request volume, latency, status codes, and endpoint health, then exposes the results through a React dashboard and role-based admin workflows.

This repository contains four major parts:

- Backend API server that accepts monitored hits and serves analytics
- Background queue consumer that processes events asynchronously
- React dashboard for login, analytics, alerts, and settings
- Demo client that shows how a monitored application sends data to the platform

## Architecture at a glance

```text
Client app / demo API
        |
        |  POST /api/hit with x-api-key
        v
API Server (Express)
        |
        |  validate API key + auth
        v
RabbitMQ queue (api_hits)
        |
        v
Consumer worker
        |--> MongoDB: raw/aggregated monitoring records
        |--> PostgreSQL: users, clients, API keys, alerts, synthetic checks
        |
        v
Dashboard (React + Vite)
        |
        +--> /api/auth, /api/analytics, /api/alerts, /api/synthetics
```

## Project layout

```text
API-Monitoring-System/
├── README.md
├── docs/
│   ├── architecture.md
│   ├── backend-server.md
│   ├── dashboard.md
│   ├── demo-client.md
│   └── deployment.md
├── server/
│   ├── src/
│   ├── package.json
│   ├── Dockerfile
│   ├── Dockerfile.consumer
│   ├── .env
│   ├── .env.production
│   ├── docker-compose.yml
│   ├── docker-compose.prod.yml
│   └── scripts/
├── dashboard/
│   ├── src/
│   ├── package.json
│   └── vite.config.*
├── demo/
│   └── code_architecture/
├── simulator.js
├── create-admin.js
├── cookies.txt
├── data.md
├── data_deploy.md
├── explain.md
└── logs/
```

## What each part does

### 1. Backend server
The server in `server/` is the core monitoring application. It exposes:

- authentication and user approval flows
- client registration and API key creation
- ingest endpoint for monitoring payloads
- analytics endpoints for charts and metrics
- alert and synthetic monitoring logic

See [docs/backend-server.md](./docs/backend-server.md).

### 2. Queue consumer and processor
The worker in `server/src/services/processor/consumer.js` consumes RabbitMQ messages and transforms them into aggregated data for charts and alert evaluation. It keeps the ingest API fast and non-blocking.

See [docs/architecture.md](./docs/architecture.md).

### 3. Dashboard
The dashboard in `dashboard/` is the user-facing React app. It includes login, signup, analytics pages, alerts, synthetic checks, settings, and admin approval workflows.

See [docs/dashboard.md](./docs/dashboard.md).

### 4. Demo client
The demo app under `demo/code_architecture/` shows how external services send monitoring data to PulseWatch. It includes a reusable `monitoring.js` middleware and a sample API server.

See [docs/demo-client.md](./docs/demo-client.md).

## Quick start

### Prerequisites

- Node.js 18+
- npm
- PostgreSQL
- MongoDB
- RabbitMQ
- Docker (optional for local infra)

### 1) Start the backend

```bash
cd server
npm install
npm run dev
```

The server listens on port `5000` by default and exposes health at `GET /health`.

### 2) Start the dashboard

```bash
cd dashboard
npm install
npm run dev
```

Open the dashboard at `http://localhost:5173`.

### 3) Start the demo monitored service

```bash
cd demo/code_architecture
npm install
npm start
```

The demo API runs on `http://localhost:3002` and automatically submits monitoring hits to the backend when configured with a valid API key.

## Admin access

Create the initial super-admin account using the project's secure onboarding/bootstrap process. Do not use a password copied from example documentation; use a unique password and rotate any credentials that may have been shared previously.

## Main API flow

A standard monitoring request follows this path:

1. A monitored app calls a route and triggers the middleware.
2. The middleware records method, path, status code, and latency.
3. It sends a POST to `http://<backend>/api/hit` with an API key.
4. The backend validates the API key and enqueues the event in RabbitMQ.
5. The consumer aggregates the event and persists it in MongoDB/PostgreSQL.
6. The dashboard reads from the analytics endpoints and renders charts.

## Useful commands

```bash
# Backend
cd server
npm run dev
npm run processor

# Dashboard
cd dashboard
npm run dev
npm run build

# Demo
cd demo/code_architecture
npm start
npm test
```

## Documentation map

- [docs/architecture.md](./docs/architecture.md) — system design and data flow
- [docs/backend-server.md](./docs/backend-server.md) — server modules, middleware, routes, and responsibilities
- [docs/dashboard.md](./docs/dashboard.md) — frontend overview and page usage
- [docs/demo-client.md](./docs/demo-client.md) — monitoring middleware and demo service integration
- [docs/deployment.md](./docs/deployment.md) — local setup, Docker, and production deployment details

## Notes

- Keep API keys in server-side environment variables only.
- Do not expose raw credentials or secrets in browser code.
- Production deployment should use proper secrets, TLS, and network isolation.

For detailed setup instructions and production hosting guidance, read the docs in the [docs/](./docs/) folder.

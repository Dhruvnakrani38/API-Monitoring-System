# System architecture

This document explains how the different parts of PulseWatch work together.

## 1. Core idea

PulseWatch is built around an asynchronous monitoring pipeline:

- an application under observation sends metric events
- the API server validates and enqueues them
- a worker processes them in the background
- the dashboard fetches the aggregated result for display

This design keeps the monitored application fast and avoids blocking user requests on database writes.

## 2. Main components

### API server
The Express app in `server/src/server.js` is the main entry point. It:

- starts the HTTP server
- loads environment config
- connects MongoDB and PostgreSQL
- connects RabbitMQ if available
- registers route modules for auth, ingest, analytics, alerts, and synthetics
- starts the background consumer on boot

### Message queue
RabbitMQ is used as the durable event buffer. The queue name is configured by `RABBITMQ_QUEUE` and defaults to `api_hits`.

This decouples the monitored app from the slow work of database aggregation and dashboard processing.

### Background processor
The worker in `server/src/services/processor/consumer.js` listens for queue messages, validates payloads, and processes them. It also runs alert evaluation and synthetic monitoring checks periodically.

### Databases

- MongoDB stores monitoring records and time-based analytics data
- PostgreSQL stores users, clients, API keys, alerts, and synthetic checks

### Dashboard
The React/Vite app in `dashboard/src` communicates with the backend through `/api/*` routes and displays charts and status panels.

## 3. Request flow

```text
Monitored API request
  -> middleware captures endpoint, method, latency, status
  -> HTTP POST to /api/hit with x-api-key
  -> server validates client key and request payload
  -> server pushes event to RabbitMQ
  -> background consumer receives event
  -> consumer validates ingest payload, updates aggregates, writes DB records
  -> analytics APIs read the processed data
  -> dashboard displays KPI cards and charts
```

## 4. Why the queue exists

Without a queue, the monitored application would have to wait for database writes and calculations on every request. That creates latency and makes the system fragile under load.

The queue allows:

- fast request handling
- backpressure control
- retries and dead-letter handling
- smoother scaling

## 5. Processing responsibilities

### Ingest layer
The ingest path accepts API hit events and returns `202 Accepted` once the message is queued for processing. It validates the API key and user association before queueing the payload.

### Consumer layer
The consumer:

- reads from the RabbitMQ queue
- validates the schema
- prevents duplicate processing with message IDs
- updates MongoDB/PostgreSQL aggregates
- evaluates alerts
- handles retry and dead-letter workflows

### Analytics layer
The analytics service reads the processed data and returns:

- total hits
- success/error counts
- average latency
- endpoint rankings
- time-series views

## 6. Permission model

The system separates user roles and client boundaries:

- `super_admin`: global access to analytics and user approval workflows
- `client_admin`: manages a specific client and its users
- `client_viewer`: read-only role for a client

The backend uses JWT authentication and role-based authorization middleware before allowing certain actions.

## 7. Key files

- `server/src/server.js` — bootstrap app and DB initialization
- `server/src/services/ingest/routes/ingestRoutes.js` — ingest endpoint registration
- `server/src/services/processor/consumer.js` — background worker
- `server/src/services/analytics/routes/analyticsRoutes.js` — analytics endpoints
- `dashboard/src/App.jsx` — dashboard route auth flow
- `demo/code_architecture/monitoring.js` — middleware used by external apps

## 8. Operational notes

- The app is designed for asynchronous ingestion rather than synchronous SQL writes on every request.
- Database connectivity is initialized during server startup.
- RabbitMQ failures do not necessarily block startup; the app logs warnings and continues in degraded mode.
- The consumer runs periodic alert and synthetic evaluation loops every 30 seconds.

## 9. Typical deployment topology

```text
Internet
  -> Vercel frontend
  -> Railway API backend
  -> PostgreSQL
  -> MongoDB
  -> RabbitMQ
  -> background consumer
```

This architecture is suitable for production use when paired with secrets management, secure CORS rules, and environment-specific `.env` files.

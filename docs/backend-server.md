# Backend server

The backend is the main service in `server/`. It handles authentication, client onboarding, API key validation, ingesting monitoring data, and serving analytics.

## 1. Responsibilities

The server is responsible for:

- user signup, login, logout, and profile retrieval
- approval of new users by a super admin
- client registration and API key management
- validation of monitored applications using `x-api-key`
- enqueueing incoming monitoring events in RabbitMQ
- returning dashboard statistics and endpoint data
- evaluating alerts and synthetic checks

## 2. Entry point

The app boots from `server/src/server.js`.

Key startup behavior:

- config loads environment variables from `.env`
- MongoDB is connected
- PostgreSQL is checked for connectivity
- RabbitMQ is initialized if available
- middleware and not-found handlers are registered
- `/api/*` routes are mounted
- background consumer is started with `startConsumerWithRetry()`

## 3. Middleware stack

The app uses several standard Express middlewares:

- `helmet` for secure headers
- `cors` with allowed origins
- `cookie-parser` for JWT cookies
- `express.json()` and `express.urlencoded()` for request parsing
- request logger for auditing
- global error handler

## 4. Route modules

### Authentication routes
Mounted at `/api/auth`.

Examples:

- `POST /api/auth/signup` — public sign-up
- `POST /api/auth/login` — login and JWT cookie creation
- `GET /api/auth/profile` — current user profile
- `GET /api/auth/logout` — remove auth cookie
- `GET /api/auth/admin/pending-users` — pending users for approval
- `POST /api/auth/admin/users/:userId/approve` — approve user
- `POST /api/auth/admin/users/:userId/reject` — reject user

### Client and API key routes
Mounted at `/api`.

Examples:

- `POST /api/admin/clients/onboard`
- `GET /api/admin/clients`
- `GET /api/admin/clients/:clientId/users`
- `POST /api/admin/clients/:clientId/api/keys`
- `GET /api/admin/clients/:clientId/api/keys`

### Ingest routes
Mounted at `/api/hit`.

- `POST /api/hit` — ingests monitoring payloads from client apps

This route is protected by API key validation and a rate limiter.

### Analytics routes
Mounted at `/api/analytics`.

- `GET /api/analytics/stats`
- `GET /api/analytics/dashboard`
- `GET /api/analytics/endpoint-details`

These endpoints return aggregated metrics for the dashboard and drill-down views.

### Alerts and synthetics

- `/api/alerts` — alert rules, incidents, and notification logic
- `/api/synthetics` — synthetic checks and runs

## 5. Authentication and authorization

The server uses JWT-based authentication. After login, the JWT is sent via HTTP-only cookie and validated by `authenticate` middleware.

Role checks are enforced with `authorize`, which restricts actions based on a role list such as:

- `super_admin`
- `client_admin`
- `client_viewer`

## 6. API key validation flow

Client applications do not use user JWTs for ingestion. Instead, they send an API key in the `x-api-key` header.

The validation flow is:

1. API key arrives at `/api/hit`
2. `validateApiKey` checks the supplied key against the database
3. the valid client is attached to `req.client`
4. the hit is passed into the ingest service
5. the event is queued to RabbitMQ for background processing

## 7. Processor worker flow

The background consumer in `server/src/services/processor/consumer.js`:

- opens a RabbitMQ channel
- sets the prefetch limit
- consumes from `api_hits`
- validates each message schema
- prevents duplicate processing
- calls the processor service
- stores the result in MongoDB/PostgreSQL
- triggers alert evaluation and synthetic checks

## 8. Data model summary

### PostgreSQL
Used for structured systems data:

- users
- roles and permissions
- clients
- API keys
- alert definitions and incidents
- synthetic monitor records

### MongoDB
Used for monitoring data and high-volume time-series metrics.

## 9. Environment configuration

The server expects environment variables such as:

```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/api_monitoring
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=api_monitoring
PG_USER=postgres
PG_PASSWORD=your_password
RABBITMQ_URL=amqp://localhost:5672
JWT_SECRET=your_secret
CORS_ORIGINS=http://localhost:5173
```

See the local `.env` files inside `server/` for environment examples.

## 10. How to run it locally

```bash
cd server
npm install
npm run dev
```

This starts the API server and the background consumer is launched automatically by `server.js`.

## 11. Useful endpoints

- `GET /health` — service health
- `GET /` — basic service metadata
- `POST /api/hit` — ingest monitoring event
- `GET /api/analytics/dashboard` — dashboard data
- `GET /api/analytics/stats` — overall stats
- `GET /api/auth/profile` — authenticated user profile

## 12. Notes

- Ingest requests should be asynchronous from the monitored service; they are intentionally fast and non-blocking.
- The backend is built to be modular, with controllers, services, repositories, routes, and dependency containers separated by domain.
- Production deployments should use secure env secrets and avoid exposing DB ports publicly.

# Deployment and operations

This document covers how the project is run locally and how it is structured for production.

## 1. Local development setup

### Requirements

- Node.js 18+
- npm
- PostgreSQL
- MongoDB
- RabbitMQ
- Optional: Docker Compose for infrastructure

### Start backend

```bash
cd server
npm install
npm run dev
```

### Start dashboard

```bash
cd dashboard
npm install
npm run dev
```

### Start demo service

```bash
cd demo/code_architecture
npm install
npm start
```

## 2. Docker environment

This repository contains Docker files and Compose config for the server environment.

Examples:

- `server/docker-compose.yml`
- `server/docker-compose.prod.yml`
- `server/Dockerfile`
- `server/Dockerfile.consumer`

These files are useful for container-based provisioning and local infrastructure setup.

## 3. Production architecture

A common production deployment looks like:

```text
Browser
  -> Vercel frontend
  -> Railway backend
  -> PostgreSQL
  -> MongoDB
  -> RabbitMQ
  -> background consumer
```

The system is designed so the main API service and queue processor live behind a common backend deployment while the frontend is separated as a client UI.

## 4. Environment variables for production

The server should use strong secret values and environment-specific config.

Example:

```env
NODE_ENV=production
PORT=5000
JWT_SECRET=very_long_random_secret
MONGO_URI=mongodb://mongo:27017/api_monitoring
PG_HOST=postgres
PG_PORT=5432
PG_DATABASE=api_monitoring
PG_USER=postgres
PG_PASSWORD=strong_password
RABBITMQ_URL=amqp://rabbitmq:5672
CORS_ORIGINS=https://your-frontend.example.com
```

## 5. Super admin onboarding

The project includes a super admin bootstrap path. In production, the initial admin should be created carefully using environment variables or a secure setup process.

Typical values include:

- username: `admin`
- email: `admin@example.com`
- role: `super_admin`

After onboarding, the project docs recommend that the bootstrap route be treated as a one-time step and disabled afterward.

## 6. Security guidance

- Keep `.env` files out of version control
- Use strong DB and JWT secrets
- Restrict CORS to trusted origins
- Do not expose DB ports publicly
- Keep API keys in server-side environment files only
- Use HTTPS in production

## 7. Operational checklist

Before deployment:

- confirm PostgreSQL, MongoDB, and RabbitMQ connectivity
- verify that the consumer starts without errors
- confirm that `/health` returns a valid status
- validate the dashboard can authenticate against the backend
- test a sample monitoring event with an API key

## 8. Useful command reference

```bash
# API server
cd server
npm install
npm run dev

# Queue worker (if started independently)
cd server
npm run processor

# Frontend
cd dashboard
npm install
npm run build
npm run preview
```

## 9. Final note

PulseWatch is built to be modular and production-aware. The backend is fast at the edge, the processor handles heavy work asynchronously, and the dashboard provides the monitoring experience for operators and application admins.

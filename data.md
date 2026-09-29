# API Monitoring System - Service Configuration Data

This file contains all service configurations, ports, environment variables, and credentials for the API Monitoring System.

---

## Database Services

### PostgreSQL
- **Container Name**: api-monitoring-postgres
- **Image**: postgres:15-alpine
- **Port**: 5432 (host:container)
- **Database**: api_monitoring
- **Username**: postgres
- **Password**: dhruv@123
- **Volume**: postgres_data (preserved)
- **Network**: api-monitoring-network
- **Health Check**: pg_isready -U postgres -d api_monitoring

### MongoDB
- **Container Name**: api-monitoring-mongo
- **Image**: mongo:6.0
- **Port**: 27018:27017 (host:container)
- **Database**: api_monitoring
- **Volume**: mongo_data (preserved)
- **Network**: api-monitoring-network

---

## Message Queue

### RabbitMQ
- **Container Name**: api-monitoring-rabbitmq
- **Image**: rabbitmq:3-management-alpine
- **AMQP Port**: 5672 (host:container)
- **Management UI Port**: 15672 (host:container)
- **Username**: api_user
- **Password**: dhruv@123
- **Virtual Host**: api_monitoring
- **Volume**: rabbitmq_data (preserved)
- **Network**: api-monitoring-network
- **Health Check**: rabbitmq-diagnostics -q ping

---

## Admin Tools

### pgAdmin
- **Container Name**: api-monitoring-pgadmin
- **Image**: dpage/pgadmin4:7
- **Port**: 8081:80 (host:container)
- **Email**: admin@example.com
- **Password**: dhruv@123
- **Volume**: pgadmin_data (preserved)
- **Network**: api-monitoring-network
- **Depends On**: postgres

---

## Application Services

### API App
- **Container Name**: api-monitoring-app
- **Port**: 5000:5000 (host:container)
- **Environment Variables**:
  - NODE_ENV: production
  - PORT: 5000
  - MONGO_URI: mongodb://mongo:27017/api_monitoring
  - MONGO_DB_NAME: api_monitoring
  - PG_HOST: postgres
  - PG_PORT: 5432
  - PG_DATABASE: api_monitoring
  - PG_USER: postgres
  - PG_PASSWORD: dhruv@123
  - RABBITMQ_URL: amqp://api_user:dhruv@123@rabbitmq:5672/api_monitoring
  - RABBITMQ_QUEUE: api_hits
  - JWT_SECRET: d65f785253c7e523944114b3499e690ffb049fe18f7dbfbf68891f273d02f19e36f799d4266df480e52c3cec6590f85560c199f79bbd78a38bb313a0446e70a4
  - JWT_EXPIRES_IN: 24h
  - RATE_LIMIT_WINDOW_MS: 60000
  - RATE_LIMIT_MAX_REQUESTS: 100
- **Volume**: ./logs:/app/logs
- **Network**: api-monitoring-network
- **Health Check**: curl -f http://localhost:5000/health

### Consumer Service
- **Container Name**: api-monitoring-consumer
- **Environment Variables**:
  - NODE_ENV: production
  - MONGO_URI: mongodb://mongo:27017/api_monitoring
  - MONGO_DB_NAME: api_monitoring
  - PG_HOST: postgres
  - PG_PORT: 5432
  - PG_DATABASE: api_monitoring
  - PG_USER: postgres
  - PG_PASSWORD: dhruv@123
  - RABBITMQ_URL: amqp://api_user:dhruv@123@rabbitmq:5672/api_monitoring
  - RABBITMQ_QUEUE: api_hits
  - JWT_SECRET: d65f785253c7e523944114b3499e690ffb049fe18f7dbfbf68891f273d02f19e36f799d4266df480e52c3cec6590f85560c199f79bbd78a38bb313a0446e70a4
- **Volume**: ./logs:/app/logs
- **Network**: api-monitoring-network

---

## Demo Service

### Blog API Demo
- **Port**: 3002
- **Service Name**: blog-api
- **Environment Variables**:
  - PORT: 3002
  - SERVICE_NAME: blog-api
  - MONITORING_API_KEY: apim_aac1d5e798d0d95cc25178b41e5b593d3b8a4521
  - MONITORING_ENDPOINT: http://localhost:5000/api/hit
  - MONITORING_ENABLED: true
  - NODE_ENV: development

---

## Dashboard

### Frontend Dashboard
- **Port**: 5173
- **Environment Variables**:
  - VITE_API_BASE_URL: /api
  - VITE_ERROR_REPORT_URL: (empty - disabled)
  - PORT: 5173

---

## Docker Volumes (Preserved)

- postgres_data
- mongo_data
- rabbitmq_data
- pgadmin_data

---

## Network

- **Name**: api-monitoring-network
- **Driver**: bridge

---

## Configuration Files

- **Main Docker Compose**: server/docker-compose.yml
- **Server Config**: server/src/shared/config/index.js
- **Demo Environment**: demo/code_architecture/.env
- **Dashboard Environment**: dashboard/.env.example

---

## Security Notes

- All database passwords have been updated to: dhruv@123
- JWT secret has been regenerated with a secure 64-byte random value
- Volumes are preserved to maintain data persistence
- Consider rotating these credentials regularly in production
- Never commit this file with real credentials to public repositories
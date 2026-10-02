# PlusWatch API Monitoring System by DN Systems

## 1. Project Flow and Architecture

The PlusWatch project by DN Systems is a full-stack, real-time API monitoring solution designed to capture, process, and visualize API metrics.

### Core Components
1. **Client API (Demo Blog)**: The application being monitored. It uses a lightweight `monitoring.js` middleware.
2. **Backend Server (Ingestion & Processing)**: A Node.js service that exposes ingestion and analytics endpoints.
3. **Message Queue (RabbitMQ)**: Acts as a buffer to handle high volumes of incoming API hits without blocking the main server.
4. **Consumer Worker**: A background Node.js process that reads messages from RabbitMQ, aggregates them into time buckets, and saves them to the database.
5. **Database (PostgreSQL & MongoDB)**: Postgres is used for structured, time-series metrics (endpoints, latency, hits), while MongoDB manages user/client configurations.
6. **Dashboard (Frontend)**: A React/Vite web interface that queries the Backend Server to display real-time graphs and analytics.

---

## 2. How it Works (Data Flow)

Here is the step-by-step lifecycle of a single monitored API request:

1. **Request Interception**: A user makes a request to the monitored Client API (e.g., `GET /api/posts`). The `monitoring.js` middleware intercepts it.
2. **Metric Collection**: The middleware records the start time. When the response finishes, it calculates the **latency** and captures the **HTTP method**, **endpoint path**, and **status code**.
3. **Asynchronous Ingestion**: The middleware sends a non-blocking HTTP POST request with these metrics (and the `MONITORING_API_KEY`) to the Backend Ingestion Server (`/api/hit`).
4. **Message Queuing**: The Backend Server validates the API key, authenticates the client, and immediately pushes the payload to a RabbitMQ queue (`api_hits`).
5. **Background Processing**: The isolated Consumer Worker pulls batches of metrics from RabbitMQ. It aggregates them by specific time windows (e.g., updating a record for `10:00 - 11:00`) to save database overhead.
6. **Data Storage**: The aggregated metrics (total hits, error counts, min/max/avg latency) are upserted into PostgreSQL.
7. **Visualization**: The admin logs into the Dashboard, which fetches these metrics via `/api/analytics` and renders them visually.

---

## 3. Data Simulator

To test the system and populate the dashboard with realistic charts, you can use a Data Simulator. Below is a simple Node.js simulator script that generates random traffic to your Demo API.

### `simulator.js`
Create this file and run it using `node simulator.js`.

```javascript
const http = require('http');

// Configuration
const TARGET_API_URL = 'http://localhost:3002';
const REQUESTS_PER_SECOND = 5;

const ENDPOINTS = [
    { path: '/api/posts', weight: 60 },          // 60% of traffic
    { path: '/api/posts/1/comments', weight: 30 }, // 30% of traffic
    { path: '/api/invalid-route', weight: 10 }     // 10% of traffic (Generates errors)
];

// Helper to pick a random endpoint based on weight
function getRandomEndpoint() {
    const totalWeight = ENDPOINTS.reduce((sum, ep) => sum + ep.weight, 0);
    let randomNum = Math.random() * totalWeight;
    for (const endpoint of ENDPOINTS) {
        if (randomNum < endpoint.weight) return endpoint.path;
        randomNum -= endpoint.weight;
    }
}

// Function to simulate a hit
function simulateHit() {
    const endpoint = getRandomEndpoint();
    const url = `${TARGET_API_URL}${endpoint}`;
    
    http.get(url, (res) => {
        console.log(`[HIT] ${res.statusCode} - ${url}`);
    }).on('error', (err) => {
        console.error(`[ERROR] Failed to hit ${url}: ${err.message}`);
    });
}

// Start Simulator
console.log(`Starting Data Simulator targeting ${TARGET_API_URL}...`);
console.log(`Sending ~${REQUESTS_PER_SECOND} requests per second.`);

setInterval(simulateHit, 1000 / REQUESTS_PER_SECOND);
```

### How to use the simulator:
1. Ensure your **Demo Blog API** (`localhost:3002`) and **Backend Server** are running.
2. Save the code above as `simulator.js` in your root directory.
3. Open a terminal and run `node simulator.js`.
4. Keep it running for a few minutes, then check your **Dashboard** to see the graphs automatically populate!

For your PulseWatch backend, deploy it in this order. Don’t jump directly into GitHub Actions yet. Humans already have enough ways to automate broken things.

Your target production setup should be:

```
                    Internet
                       │
                       ▼
                  Nginx :80/:443
                       │
                       ▼
                server-api :5000
                       │
          ┌────────────┼─────────────┐
          ▼            ▼             ▼
      PostgreSQL     MongoDB      RabbitMQ
       :5432         :27017        :5672
          │            │             │
          └────────────┴─────────────┘
                       │
                    Worker
                       │
                       ▼
                     Redis
```

Your project documentation already defines Docker Compose as the deployment layer and includes Node.js API, MongoDB, PostgreSQL, RabbitMQ, pgAdmin and Redis.    Troubleshoot DevOps Problem

### 1. Prepare the VPS
On your VPSWala Professional VPS, install:

```
sudo apt update
sudo apt upgrade -y
```

Then install Git, Docker and Docker Compose:

```
sudo apt install git -y
```

Install Docker:

```
curl -fsSL https://get.docker.com | sudo sh
```

Allow your user to run Docker:

```
sudo usermod -aG docker $USER
```

Then reconnect to SSH.

Check:

```
docker --version
docker compose version
```

You should get something like:

```
Docker version ...
Docker Compose version ...
```

### 2. Clone your backend repository
For example:

```
cd /opt
sudo git clone YOUR_GITHUB_REPO_URL pulsewatch
cd pulsewatch
```

Your VPS should eventually have something like:

```
/opt/pulsewatch/
│
├── server/
│   ├── src/
│   ├── package.json
│   └── Dockerfile
│
├── consumer/
│   ├── src/
│   ├── package.json
│   └── Dockerfile
│
├── docker-compose.yml
├── docker-compose.prod.yml
└── .env
```

### 3. Create the production environment
Do NOT copy your development `.env` blindly.

Create:

```
nano .env
```

Something along the lines of:

```
NODE_ENV=production
PORT=5000

MONGO_URI=mongodb://root:STRONG_PASSWORD@mongo:27017/api_monitoring?authSource=admin

PG_HOST=postgres
PG_PORT=5432
PG_DATABASE=api_monitoring
PG_USER=postgres
PG_PASSWORD=STRONG_PASSWORD

RABBITMQ_URL=amqp://api_user:STRONG_PASSWORD@rabbitmq:5672

JWT_SECRET=VERY_LONG_RANDOM_SECRET

REDIS_HOST=redis
REDIS_PORT=6379
```

The important difference is this:

```
Local:

localhost:5432
localhost:27017
localhost:5672

Docker:

postgres:5432
mongo:27017
rabbitmq:5672
```

Inside Docker, `localhost` means **the current container**, not the PostgreSQL/Mongo/RabbitMQ container.

That's one of those tiny details that has caused approximately seven billion developer headaches.

### 4. Create production Docker Compose
Your production Compose should contain your application and infrastructure:

```
services:

  server:
    build:
      context: ./server
    container_name: pulsewatch-server
    env_file:
      - .env
    ports:
      - "5000:5000"
    depends_on:
      postgres:
        condition: service_healthy
      mongo:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - pulsewatch-network

  consumer:
    build:
      context: ./consumer
    container_name: pulsewatch-consumer
    env_file:
      - .env
    depends_on:
      rabbitmq:
        condition: service_healthy
      postgres:
        condition: service_healthy
      mongo:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - pulsewatch-network

  postgres:
    image: postgres:15-alpine
    container_name: pulsewatch-postgres
    ...
    
  mongo:
    image: mongo:6
    container_name: pulsewatch-mongo
    ...

  rabbitmq:
    image: rabbitmq:3-management-alpine
    container_name: pulsewatch-rabbitmq
    ...

  redis:
    image: redis:7-alpine
    container_name: pulsewatch-redis
    ...

networks:
  pulsewatch-network:
    driver: bridge

volumes:
  postgres_data:
  mongo_data:
  rabbitmq_data:
  redis_data:
```

Notice something important: **you don't need to expose every service to the Internet.**

For production:

```
Server        → public through Nginx
PostgreSQL    → internal only
MongoDB       → internal only
RabbitMQ      → internal only
Redis         → internal only
Worker        → internal only
```

Don't do this:

```
ports:
  - "5432:5432"
  - "27017:27017"
  - "5672:5672"
  - "6379:6379"
```

unless you have a specific reason.

### 5. Start the stack manually
First:

```
docker compose -f docker-compose.prod.yml up -d --build
```

Then:

```
docker compose -f docker-compose.prod.yml ps
```

You want something approximately like:

```
pulsewatch-server       Up
pulsewatch-consumer     Up
pulsewatch-postgres     Up (healthy)
pulsewatch-mongo        Up (healthy)
pulsewatch-rabbitmq     Up (healthy)
pulsewatch-redis        Up
```

Then check your API:

```
curl http://localhost:5000/api/health
```

You should get your health response.

If it fails:

```
docker compose -f docker-compose.prod.yml logs server
```

For the worker:

```
docker compose -f docker-compose.prod.yml logs consumer
```

RabbitMQ:

```
docker compose -f docker-compose.prod.yml logs rabbitmq
```

### 6. Add Nginx
Once the API works directly on:

```
VPS_IP:5000
```

put Nginx in front of it.

Architecture becomes:

```
https://api.yourdomain.com
          │
          ▼
        Nginx
          │
          ▼
  http://server:5000
```

Nginx configuration:

```
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:5000;

        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Then later add HTTPS using Let's Encrypt/Certbot.

### 7. Test the complete system
Don't only test `/health`.

Test the actual PulseWatch flow:

```
Customer API
     │
     │ monitoring SDK
     ▼
POST /api/hit
     │
     ▼
PulseWatch server
     │
     ▼
RabbitMQ
     │
     ▼
Consumer
     │
     ├──► MongoDB
     │
     └──► PostgreSQL
              │
              ▼
          Dashboard
```

Your project documentation describes this asynchronous RabbitMQ → worker architecture specifically to separate ingestion from background processing.    Troubleshoot DevOps Problem

Check:

```
docker compose logs -f server
```

and:

```
docker compose logs -f consumer
```

Then send an API request through your monitoring SDK.

Verify:

```
API request
    ↓
/api/hit
    ↓
RabbitMQ message
    ↓
Consumer receives
    ↓
Mongo record
    ↓
Postgres aggregate
    ↓
Dashboard result
```

### 8. Only after this works, build CI/CD
Then your GitHub Actions pipeline becomes:

```
Developer
    │
    ▼
git push
    │
    ▼
GitHub
    │
    ▼
GitHub Actions
    │
    ├── npm install
    ├── lint
    ├── tests
    ├── Docker build
    └── security scan
           │
           ▼
       Docker image
           │
           ▼
      Docker Registry
           │
           ▼
          VPS
           │
           ▼
 docker compose pull
           │
           ▼
 docker compose up -d
           │
           ▼
     health check
```

For your project, I'd use **GHCR (GitHub Container Registry)** so the images stay associated with your GitHub repository.

The deployment workflow eventually does roughly:

```
docker login ghcr.io

docker compose pull

docker compose up -d

docker image prune -f
```

But don't automate this part until the manual deployment works.

### Your actual deployment roadmap

```
STEP 1
VPS
 ↓
SSH working

STEP 2
Install Docker
 ↓
Docker working

STEP 3
Clone PulseWatch
 ↓
Repository working

STEP 4
Production .env
 ↓
Secrets configured

STEP 5
Docker Compose
 ↓
Postgres + Mongo + RabbitMQ + Redis
 ↓
Server + Consumer

STEP 6
Test localhost:5000
 ↓
API works

STEP 7
Nginx
 ↓
Domain
 ↓
HTTPS

STEP 8
Test complete monitoring pipeline
 ↓
SDK → API → RabbitMQ → Worker → DB

STEP 9
GitHub Actions
CI
 ↓
Build image
 ↓
Push image
 ↓
Deploy VPS

STEP 10
Automatic deployment
```

For **your current stage**, the next thing to do is **Step 1: connect to the VPS over SSH and prepare Docker**. Don't touch GitHub Actions yet. Once the containers are running manually, CI/CD becomes mostly automation of commands you've already proven.s
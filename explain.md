# PulseWatch API Monitoring System

## 1. Project Flow and Architecture

The PulseWatch project is a full-stack, real-time API monitoring solution designed to capture, process, and visualize API metrics. 

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

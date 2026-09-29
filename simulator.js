const http = require('http');

// Configuration
const TARGET_API_URL = 'http://localhost:3002';
const REQUESTS_PER_SECOND = 1;

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

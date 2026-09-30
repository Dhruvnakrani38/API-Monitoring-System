# Demo Blog API

A simple blog API demonstrating monitoring integration with the API Monitoring System.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure the environment in the same PowerShell session where you start the server:
```powershell
$env:PULSEWATCH_URL = 'http://localhost:5000'
$env:PULSEWATCH_API_KEY = '<active client API key copied from PulseWatch>'
$env:PULSEWATCH_SERVICE_NAME = 'demo-api'
$env:PORT = '3002'
```

Keep the API key in the server environment. Do not commit it or put it in browser code.

3. Start the server:
```bash
npm start
```

The demo exposes ten sample endpoints at `/api/demo/endpoint-1` through `/api/demo/endpoint-10`.

## Load test

Start the demo server in one terminal. In a second PowerShell terminal, set the same `PULSEWATCH_URL` and `PULSEWATCH_API_KEY`, then run:

```powershell
$env:LOAD_RPS = '1000'
$env:LOAD_DURATION_SECONDS = '10'
npm run load
```

The runner is capped at 1,000 requests per second and 60 seconds. Its default run sends 10,000 requests across the ten demo routes, prints status counts, and waits for asynchronous monitoring requests to drain. It first sends one ingest preflight request and refuses to start the load if the key is invalid or PulseWatch does not return HTTP 202.

## API Endpoints

### GET /api/posts
Get all blog posts with optional filtering.

**Query Parameters:**
- `author` - Filter posts by author name
- `tag` - Filter posts by tag
- `limit` - Maximum number of posts to return (default: 10)

**Example:**
```bash
curl "http://localhost:3002/api/posts?tag=nodejs&limit=5"
```

### GET /api/posts/:postId/comments
Get comments for a specific blog post.

**Parameters:**
- `postId` - The ID of the blog post

**Example:**
```bash
curl "http://localhost:3002/api/posts/1/comments"
```

## Testing

Test the monitoring integration:
```bash
npm test
```

## Monitoring

This API automatically sends monitoring data to PulseWatch using `x-api-key`:
- Response times
- Status codes
- Endpoint usage
- Error rates

Check your monitoring dashboard to see real-time API performance metrics.
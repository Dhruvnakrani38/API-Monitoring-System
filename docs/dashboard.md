# Dashboard

The dashboard is the React frontend for PulseWatch. It lets users log in, monitor API health, inspect endpoint performance, manage alerts, and configure synthetic checks.

## 1. Purpose

The dashboard turns the raw monitoring data into readable visualizations and operational actions. It provides:

- KPI cards
- endpoint rankings
- latency and hit trend charts
- user approval screens
- alerts management
- settings page

## 2. Tech stack

- React 18
- Vite
- TanStack Query
- Axios
- ApexCharts for charts
- React Router for navigation

## 3. App structure

The main dashboard sources are in `dashboard/src`:

- `App.jsx` — route and auth gating
- `api/api.js` — shared HTTP client and API helpers
- `components/` — reusable UI blocks and pages
- `pages/` — route-level pages such as Overview, Alerts, Settings, Team
- `contexts/` — theme and toast providers

## 4. Authentication flow

The app checks the current authenticated state on load through `authApi.getProfile()`.

If the request succeeds, the dashboard renders the user’s protected UI. If it fails, the app redirects the user back to the landing/login flow.

The app uses HTTP-only cookies for session handling, which means the backend owns the actual auth state rather than the browser storing tokens in JS.

## 5. Main pages

### Overview
This is the default landing page after login. It usually shows:

- overall stats
- total hits and error rate
- latency metrics
- recent activity graph
- top-performing or most-used endpoints

### Alerts
The alerts page provides management for alert rules, incidents, and status monitoring.

### Synthetic monitoring
Synthetic checks allow the system to validate service health by sending targeted checks to endpoints.

### Settings
The settings page is used for user/session configuration and account preferences.

### Team / approvals
Admin users can view pending approvals and manage users or client permissions.

## 6. API calls used by the frontend

The dashboard talks to the backend through the shared API wrapper in `dashboard/src/api/api.js`.

Common calls include:

- `authApi.login()`
- `authApi.signup()`
- `authApi.getProfile()`
- `authApi.getPendingUsers()`
- `analyticsApi.getDashboard()`
- `alertsApi.getRules()`
- `syntheticsApi.getChecks()`

## 7. Local development

From the project root:

```bash
cd dashboard
npm install
npm run dev
```

The Vite dev server runs by default on:

```text
http://localhost:5173
```

## 8. Environment configuration

The frontend can use an API base URL override:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

If this is not set, the app uses a relative `/api` path and relies on the Vite proxy or deployment rewrite configuration.

## 9. How to use it

1. Launch the backend.
2. Start the frontend.
3. Sign in with a valid user account or onboard a new one.
4. Navigate to the Overview page to see metrics.
5. Use Alerts or Synthetic pages to configure checks and respond to incidents.
6. Use the pending approvals flow when acting as a super admin.

## 10. Notes

- Dashboard data is loaded from authenticated endpoints only.
- The frontend listens for `401 Unauthorized` responses and automatically clears the session.
- Use a secure production frontend config and avoid exposing backend secrets in the browser.

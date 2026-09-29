# Client Onboarding & API Key Generation Guide

This document explains how new clients get API keys in the current API Monitoring System.

## 🔄 Current Client Onboarding Process

### **Step 1: Admin Login**
The process starts with a Super Admin logging into the system.

**Endpoint:** `POST /api/auth/login`
**Required:** Admin credentials (username/password)

### **Step 2: Create New Client**
Super Admin creates a new client account.

**Endpoint:** `POST /api/admin/clients/onboard`
**Required:** Admin authentication (cookie/token)
**Request Body:**
```json
{
  "name": "Client Name",
  "email": "client@example.com",
  "description": "Client description",
  "website": "https://client-website.com"
}
```

**Response:** Returns the created client with `clientId`

### **Step 3: Create Client User (Optional)**
Create users for the client with specific roles and permissions.

**Endpoint:** `POST /api/admin/clients/:clientId/users`
**Request Body:**
```json
{
  "username": "client-user",
  "email": "user@client.com",
  "password": "SecurePassword123!",
  "role": "CLIENT_ADMIN" // or "CLIENT_VIEWER"
}
```

**Roles:**
- `CLIENT_ADMIN`: Full permissions (can create API keys, manage users, view analytics, export data)
- `CLIENT_VIEWER`: Limited permissions (can view analytics only)

### **Step 4: Generate API Key**
Create an API key for the client to use for monitoring.

**Endpoint:** `POST /api/admin/clients/:clientId/api/keys`
**Required:** Client Admin or Super Admin permissions
**Request Body:**
```json
{
  "name": "Production Key",
  "description": "API key for production environment",
  "environment": "production"
}
```

**Response:** Returns the generated API key

---

## 🔑 API Key Generation Process

### **How API Keys Are Generated**

The system generates API keys using the following method (in `clientService.js`):

```javascript
generateApiKey() {
    const prefix = "apim";
    const randomBytes = crypto.randomBytes(20).toString("hex");
    return `${prefix}_${randomBytes}`
}
```

**Format:** `apim_[40-character-hex-string]`
**Example:** `apim_aac1d5e798d0d95cc25178b41e5b593d3b8a4521`

### **API Key Storage**

API keys are stored with the following information:
- `keyId`: UUID for internal reference
- `keyValue`: The actual API key (shown only once during creation)
- `clientId`: Associated client
- `name`: Human-readable name
- `description`: Key description
- `environment`: Production/Development
- `createdBy`: User who created the key
- `isActive`: Status of the key
- `expiresAt`: Expiration date (if set)

---

## 🛡️ Security & Permissions

### **Who Can Create API Keys:**
- **Super Admin**: Can create API keys for any client
- **Client Admin**: Can create API keys for their own client only
- **Client Viewer**: Cannot create API keys

### **Access Control:**
```javascript
// Permission check in clientService.js
if (!(user.role === APPLICATION_ROLES.SUPER_ADMIN || user.role === APPLICATION_ROLES.CLIENT_ADMIN)) {
    throw new AppError("Access denied - Only Super Admin and Client Admin can create API keys", 403)
};
```

### **Client Access Check:**
```javascript
canUserAccessClient(user, clientId) {
    if (user.role === APPLICATION_ROLES.SUPER_ADMIN) {
        return true
    }
    return user.clientId && user.clientId.toString() === clientId.toString()
}
```

---

## 📋 Quick Setup Script

The system includes a setup script (`setup-test-client.js`) that automates the process:

```javascript
// 1. Login as admin
// 2. Create client
// 3. Generate API key
// 4. Update demo environment file automatically
```

**Usage:**
```bash
node setup-test-client.js
```

---

## 🔌 API Key Usage

Once a client has an API key, they can use it to monitor their APIs:

**Headers:**
```
X-API-Key: apim_aac1d5e798d0d95cc25178b41e5b593d3b8a4521
```

**Example Request:**
```bash
curl -X POST https://your-api-monitoring.com/api/hit \
  -H "X-API-Key: apim_aac1d5e798d0d95cc25178b41e5b593d3b8a4521" \
  -H "Content-Type: application/json" \
  -d '{"endpoint": "/api/users", "method": "GET", "statusCode": 200}'
```

---

## 📊 API Key Management

### **View Client API Keys**
**Endpoint:** `GET /api/admin/clients/:clientId/api/keys`
**Returns:** List of API keys (without the actual key values for security)

### **API Key Security Features:**
- Keys are only shown once during creation
- Subsequent requests hide the `keyValue`
- Keys can be deactivated
- Keys can have expiration dates
- Keys are associated with specific environments

---

## 🎯 Complete Onboarding Example

### **Manual Process:**

```bash
# 1. Admin Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "Admin@PulseWatch2026!"}' \
  -c cookies.txt

# 2. Create Client
curl -X POST http://localhost:5000/api/admin/clients/onboard \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"name": "My Company", "email": "contact@mycompany.com", "description": "My Company API"}'

# 3. Create API Key (using clientId from step 2)
curl -X POST http://localhost:5000/api/admin/clients/{clientId}/api/keys \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"name": "Production Key", "environment": "production"}'

# 4. Use the API key for monitoring
curl -X POST http://localhost:5000/api/hit \
  -H "X-API-Key: apim_generated_key_here" \
  -H "Content-Type: application/json" \
  -d '{"endpoint": "/api/test", "method": "GET", "statusCode": 200}'
```

### **Automated Process:**
```bash
node setup-test-client.js
```

---

## 🔧 Current Implementation Files

### **Key Files:**
- **Service Logic:** <ref_file file="C:\Users\dhruv\Downloads\project-screenshort\PluseWatch\API-Monitoring-System\server\src\services\client\services\clientService.js" />
- **Controller:** <ref_file file="C:\Users\dhruv\Downloads\project-screenshort\PluseWatch\API-Monitoring-System\server\src\services\client\controller\clientController.js" />
- **Routes:** <ref_file file="C:\Users\dhruv\Downloads\project-screenshort\PluseWatch\API-Monitoring-System\server\src\services\client\routes\clientRoutes.js" />
- **Setup Script:** <ref_file file="C:\Users\dhruv\Downloads\project-screenshort\PluseWatch\API-Monitoring-System\setup-test-client.js" />

---

## 💡 Summary

**Current Onboarding Flow:**
1. Super Admin logs in
2. Super Admin creates client account
3. (Optional) Super Admin creates client users with roles
4. Super Admin or Client Admin generates API key
5. Client receives API key (shown only once)
6. Client uses API key for monitoring

**Key Features:**
- Role-based access control
- Secure API key generation
- Permission-based API key creation
- API key shown only once for security
- Client-specific API key management

**Security:**
- Only Super Admin and Client Admin can create API keys
- API keys are hidden after creation
- Client access is validated per request
- Environment-specific keys supported
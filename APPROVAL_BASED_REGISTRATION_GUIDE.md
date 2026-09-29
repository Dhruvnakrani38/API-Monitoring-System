# Approval-Based Registration System Guide

Complete guide for the new user signup and admin approval workflow system.

## 🎯 **New User Flow Overview**

### **Step 1: User Signup**
New users can sign up publicly without requiring admin intervention initially.

### **Step 2: Admin Approval**
Super Admin reviews pending registrations and approves/rejects them.

### **Step 3: Automatic Setup**
Upon approval, the system automatically:
- Creates a client account for the user
- Generates an API key
- Activates the user account

### **Step 4: User Login**
Approved users can login with their credentials and access their API key.

---

## 🔄 **Complete User Journey**

### **Phase 1: User Registration**

#### **1. User Accesses Signup Page**
- URL: `/signup` (to be added to routing)
- Publicly accessible
- No authentication required

#### **2. User Submits Signup Form**
```javascript
POST /api/auth/signup
{
  "username": "newuser",
  "email": "newuser@example.com",
  "password": "SecurePassword123!"
}
```

#### **3. System Creates Pending Account**
- User created with `approvalStatus: 'pending'`
- User set as `isActive: false`
- No client assigned yet
- No API key generated

#### **4. User Receives Confirmation**
- Success message: "Account created successfully. Please wait for admin approval."
- User cannot login yet

---

### **Phase 2: Admin Approval**

#### **1. Admin Views Pending Users**
```javascript
GET /api/auth/admin/pending-users
Headers: 
  - Cookie: authToken (Super Admin session)
```

#### **2. Admin Reviews User Details**
Response includes:
- User information (username, email, created date)
- No sensitive data shown

#### **3. Admin Approves User**
```javascript
POST /api/auth/admin/users/:userId/approve
Headers:
  - Cookie: authToken (Super Admin session)
```

#### **4. System Automatic Setup**
When admin approves:
- User status changes to `approved`
- User becomes `isActive: true`
- Client account created automatically
- API key generated automatically
- User linked to client

#### **5. Response Includes**
```json
{
  "success": true,
  "message": "User approved with client and API key",
  "data": {
    "user": { /* user details */ },
    "client": { /* client details */ },
    "apiKey": {
      "keyId": "uuid",
      "keyValue": "apim_xxx", // Only shown once!
      "name": "Default API Key",
      "environment": "production"
    }
  }
}
```

#### **6. Alternative: Admin Rejects User**
```javascript
POST /api/auth/admin/users/:userId/reject
Headers:
  - Cookie: authToken (Super Admin session)
Body:
{
  "reason": "Invalid business information"
}
```

---

### **Phase 3: User Access**

#### **1. User Attempts Login**
```javascript
POST /api/auth/login
{
  "username": "newuser",
  "password": "SecurePassword123!"
}
```

#### **2. System Checks Approval**
- If pending: "Account pending admin approval. Please contact support."
- If rejected: "Account is deactivated"
- If approved: Proceeds with login

#### **3. Successful Login**
- JWT token generated
- User can access dashboard
- User can view their API key
- User can start monitoring APIs

---

## 🔧 **API Endpoints**

### **Public Endpoints**

#### **POST /api/auth/signup**
- **Purpose**: Public user registration
- **Authentication**: Not required
- **Request Body**:
  ```json
  {
    "username": "string (3+ chars)",
    "email": "valid email",
    "password": "6+ chars, secure password"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "Account created successfully. Please wait for admin approval.",
    "data": {
      "user": {
        "username": "newuser",
        "email": "newuser@example.com",
        "approvalStatus": "pending",
        "isActive": false
      }
    }
  }
  ```

#### **POST /api/auth/login**
- **Purpose**: User login
- **Authentication**: Not required
- **Request Body**:
  ```json
  {
    "username": "string",
    "password": "string"
  }
  ```
- **Response**:
  - Success: User data + JWT token
  - Pending: "Account pending admin approval"
  - Rejected: "Account is deactivated"

### **Admin Endpoints**

#### **GET /api/auth/admin/pending-users**
- **Purpose**: Get all pending user registrations
- **Authentication**: Super Admin required
- **Response**:
  ```json
  {
    "success": true,
    "data": [
      {
        "_id": "userId",
        "username": "pendinguser",
        "email": "pending@example.com",
        "approvalStatus": "pending",
        "createdAt": "2024-01-01T00:00:00Z"
      }
    ]
  }
  ```

#### **POST /api/auth/admin/users/:userId/approve**
- **Purpose**: Approve pending user and create client + API key
- **Authentication**: Super Admin required
- **Response**:
  ```json
  {
    "success": true,
    "message": "User approved with client and API key",
    "data": {
      "user": { /* approved user */ },
      "client": { /* created client */ },
      "apiKey": {
        "keyId": "uuid",
        "keyValue": "apim_xxx", // Only shown once!
        "name": "Default API Key",
        "environment": "production"
      }
    }
  }
  ```

#### **POST /api/auth/admin/users/:userId/reject**
- **Purpose**: Reject pending user registration
- **Authentication**: Super Admin required
- **Request Body**:
  ```json
  {
    "reason": "Reason for rejection"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "User rejected successfully",
    "data": {
      "user": {
        "approvalStatus": "rejected",
        "rejectionReason": "Reason for rejection"
      }
    }
  }
  ```

---

## 🎨 **Frontend Components**

### **Signup Component**
- **File**: `dashboard/src/components/Signup.jsx`
- **Features**:
  - Public signup form
  - Form validation
  - Success confirmation
  - Link to login page
  - Shows approval waiting message

### **Integration Points**
- Add signup route to dashboard routing
- Add link to signup from login page
- Add admin approval interface (to be created)

---

## 🗄️ **Database Changes**

### **User Model Updates**
Added fields to support approval workflow:
```javascript
{
  isApproved: Boolean (default: false),
  approvalStatus: String (enum: ['pending', 'approved', 'rejected'], default: 'pending'),
  approvedBy: ObjectId (ref: 'User'),
  approvedAt: Date,
  rejectionReason: String
}
```

### **Client Auto-Creation**
When user is approved:
- Client created with user's username
- Client linked to user
- API key auto-generated
- User updated with clientId

---

## 🔒 **Security Features**

### **User Status Validation**
- Pending users cannot login
- Rejected users cannot login
- Only approved users can access system

### **API Key Security**
- API key only shown once during approval
- Subsequent requests hide the key value
- Keys linked to approved users only

### **Admin Control**
- Only Super Admin can approve/reject
- Approval audit trail (who approved, when)
- Rejection reasons stored for transparency

---

## 📋 **Implementation Checklist**

### **Backend (Completed)**
- [x] Updated User model with approval fields
- [x] Created public signup endpoint
- [x] Added approval status checks to login
- [x] Created admin approval endpoints
- [x] Implemented automatic client + API key creation
- [x] Added user repository methods
- [x] Updated dependency injection

### **Frontend (Completed)**
- [x] Created Signup component
- [x] Added signup API function
- [x] Form validation and error handling
- [x] Success confirmation UI

### **Still Needed**
- [ ] Add signup route to dashboard
- [ ] Add signup link to login page
- [ ] Create admin approval interface
- [ ] Add pending users management UI
- [ ] Email notifications (optional)

---

## 🧪 **Testing the New Flow**

### **Test 1: User Signup**
```bash
# Test public signup
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser", "email": "test@example.com", "password": "TestPass123!"}'

# Expected: Account created, pending approval
```

### **Test 2: Pending User Login**
```bash
# Try to login with pending user
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser", "password": "TestPass123!"}'

# Expected: "Account pending admin approval"
```

### **Test 3: Admin Approval**
```bash
# Get pending users (as admin)
curl -X GET http://localhost:5000/api/auth/admin/pending-users \
  -H "Cookie: authToken=admin_token"

# Approve user
curl -X POST http://localhost:5000/api/auth/admin/users/{userId}/approve \
  -H "Cookie: authToken=admin_token"

# Expected: User approved with client and API key
```

### **Test 4: Approved User Login**
```bash
# Login with approved user
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser", "password": "TestPass123!"}'

# Expected: Successful login with JWT token
```

---

## 🎯 **Benefits of This System**

### **For Users:**
- ✅ Easy self-service signup
- ✅ No need to contact admin initially
- ✅ Automatic client and API key setup
- ✅ Clear approval status feedback

### **For Admins:**
- ✅ Control over who gets access
- ✅ Automated user setup reduces manual work
- ✅ Audit trail of approvals
- ✅ Ability to reject inappropriate requests

### **For Security:**
- ✅ Approval gate prevents unauthorized access
- ✅ Automatic setup reduces human error
- ✅ API key security maintained
- ✅ Clear user lifecycle management

---

## 🚀 **Next Steps**

### **Immediate:**
1. Add signup route to dashboard
2. Create admin approval UI
3. Test complete flow end-to-end

### **Future Enhancements:**
1. Email notifications for approval/rejection
2. User profile editing
3. Admin dashboard for user management
4. Bulk approval/rejection
5. Approval workflow customization

---

## 📚 **Related Files**

### **Backend:**
- User Model: <ref_file file="C:\Users\dhruv\Downloads\project-screenshort\PluseWatch\API-Monitoring-System\server\src\shared\models\User.js" />
- Auth Service: <ref_file file="C:\Users\dhruv\Downloads\project-screenshort\PluseWatch\API-Monitoring-System\server\src\services\auth\service\authService.js" />
- Auth Controller: <ref_file file="C:\Users\dhruv\Downloads\project-screenshort\PluseWatch\API-Monitoring-System\server\src\services\auth\controller\authController.js" />
- Auth Routes: <ref_file file="C:\Users\dhruv\Downloads\project-screenshort\PluseWatch\API-Monitoring-System\server\src\services\auth\routes\authRouter.js" />
- Client Service: <ref_file file="C:\Users\dhruv\Downloads\project-screenshort\PluseWatch\API-Monitoring-System\server\src\services\client\services\clientService.js" />

### **Frontend:**
- Signup Component: <ref_file file="C:\Users\dhruv\Downloads\project-screenshort\PluseWatch\API-Monitoring-System\dashboard\src\components\Signup.jsx" />
- API Functions: <ref_file file="C:\Users\dhruv\Downloads\project-screenshort\PluseWatch\API-Monitoring-System\dashboard\src\api\api.js" />

---

## 🎉 **Summary**

The new approval-based registration system provides:

1. **Self-service signup** for new users
2. **Admin approval workflow** for access control
3. **Automatic setup** of client and API key upon approval
4. **Secure user lifecycle** management
5. **Clear communication** of approval status

This system balances user convenience with admin control while maintaining security and automating routine setup tasks.
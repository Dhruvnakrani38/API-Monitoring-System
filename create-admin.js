import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

async function createAdmin() {
    try {
        // Connect to MongoDB
        await mongoose.connect('mongodb://mongo:27017/api_monitoring');
        console.log('Connected to MongoDB');

        // Define User schema inline
        const userSchema = new mongoose.Schema({
            username: { type: String, required: true, unique: true },
            email: { type: String, required: true, unique: true },
            password: { type: String, required: true },
            role: { type: String, enum: ['super_admin', 'client_admin', 'client_viewer'], default: 'client_viewer' },
            isActive: { type: Boolean, default: true },
            isApproved: { type: Boolean, default: false },
            approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
            permissions: {
                canCreateApiKeys: { type: Boolean, default: false },
                canManageUsers: { type: Boolean, default: false },
                canViewAnalytics: { type: Boolean, default: true },
                canExportData: { type: Boolean, default: false }
            }
        }, { timestamps: true });

        const User = mongoose.model('User', userSchema);

        // Check if admin exists
        const existingAdmin = await User.findOne({ role: 'super_admin' });
        if (existingAdmin) {
            console.log('Super admin already exists');
            process.exit(0);
        }

        // Hash password
        const password = process.env.ADMIN_PASSWORD || 'ChangeMeInProd123!';
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create super admin
        const admin = await User.create({
            username: 'admin',
            email: 'admin@example.com',
            password: hashedPassword,
            role: 'super_admin',
            isActive: true,
            isApproved: true,
            approvalStatus: 'approved',
            permissions: {
                canCreateApiKeys: true,
                canManageUsers: true,
                canViewAnalytics: true,
                canExportData: true
            }
        });

        console.log('Super admin created successfully:', admin.username);
        console.log('Password:', password);
        process.exit(0);
    } catch (error) {
        console.error('Error creating admin:', error);
        process.exit(1);
    }
}

createAdmin();
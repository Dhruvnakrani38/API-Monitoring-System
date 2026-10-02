async function setup() {
    try {
        console.log("1. Creating super admin directly...");
        
        // First, let's try to login with existing admin
        let res = await fetch('http://localhost:5000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'admin',
                password: process.env.ADMIN_PASSWORD || 'ChangeMeInProd123!'
            })
        });
        
        let data = await res.json();
        
        if (res.ok && data.success) {
            console.log("   Admin already exists, using existing credentials");
            var cookies = res.headers.get('set-cookie');
        } else {
            console.log("   Admin doesn't exist or login failed, trying to create...");
            console.log("   Note: You may need to manually create the admin user in MongoDB");
            console.log("   Or use the original admin credentials if they exist");
            return;
        }
        
        console.log("   Cookie received:", !!cookies);

        console.log("2. Creating client...");
        res = await fetch('http://localhost:5000/api/admin/clients/onboard', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Cookie': cookies 
            },
            body: JSON.stringify({
                name: 'Demo Client',
                description: 'My Demo App',
                email: 'demo@client.com'
            })
        });
        data = await res.json();
        if (!res.ok) throw new Error(JSON.stringify(data));
        const clientId = data.data._id;
        console.log("   Client ID:", clientId);

        console.log("3. Generating API Key...");
        res = await fetch(`http://localhost:5000/api/admin/clients/${clientId}/api/keys`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Cookie': cookies
            },
            body: JSON.stringify({
                name: 'Demo Env Key'
            })
        });
        data = await res.json();
        if (!res.ok) throw new Error(JSON.stringify(data));
        const apiKey = data.data.apiKey;
        console.log("\n   ✅ SUCCESS! NEW API KEY:", apiKey);
        
        const fs = require('fs');
        const envPath = 'c:/Users/dhruv/Downloads/project-screenshort/PluseWatch/all/API-Monitoring-System/demo/code_architecture/.env';
        let envContent = fs.readFileSync(envPath, 'utf8');
        envContent = envContent.replace(/MONITORING_API_KEY=.*/, `MONITORING_API_KEY=${apiKey}`);
        fs.writeFileSync(envPath, envContent);
        console.log("   ✅ Updated demo/.env automatically.");
        
    } catch (e) {
        console.error("Setup failed:", e.message);
        console.log("Please ensure:");
        console.log("1. Admin user exists in MongoDB");
        console.log("2. Admin credentials are: admin / Admin@PulseWatch2026!");
        console.log("3. All services are running properly");
    }
}

setup();

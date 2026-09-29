async function setup() {
    try {
        console.log("1. Logging in as admin...");
        let res = await fetch('http://localhost:5000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'admin',
                password: 'Admin@PulseWatch2026!'
            })
        });
        
        let data = await res.json();
        if (!res.ok) throw new Error(JSON.stringify(data));
        
        // Extract cookie
        const cookies = res.headers.get('set-cookie');
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
    }
}

setup();

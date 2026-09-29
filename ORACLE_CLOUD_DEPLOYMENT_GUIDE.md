# Oracle Cloud Always Free Deployment Guide

Complete step-by-step guide to deploy your API Monitoring System on Oracle Cloud Always Free tier.

## 📋 Prerequisites

- Oracle Cloud account (free)
- Basic knowledge of Linux commands
- Domain name (optional, but recommended for SSL)
- SSH client (PuTTY for Windows, Terminal for Mac/Linux)

---

## 🚀 Step 1: Create Oracle Cloud Account

1. **Sign Up for Oracle Cloud**
   - Visit: https://www.oracle.com/cloud/free/
   - Click "Try for Free"
   - Fill in your details (credit card required for verification, but you won't be charged)
   - Verify your email address

2. **Choose Your Home Region**
   - Select a region closest to your target audience
   - Popular choices: US East, EU West, Asia Pacific

3. **Wait for Account Activation**
   - Usually takes 5-10 minutes
   - You'll receive an email when your account is ready

---

## 🖥️ Step 2: Create Compute Instance

1. **Navigate to Compute**
   - Go to Oracle Cloud Console
   - Navigate to "Compute" → "Instances"
   - Click "Create Instance"

2. **Configure Instance Details**
   - **Name**: `api-monitoring-server`
   - **Compartment**: Select your compartment (default)
   - **Availability Domain**: Any available domain
   - **Shape**: Always Free Eligible → `VM.Standard.E2.1.Micro` (1 OCPU, 1GB RAM)
   - **Operating System**: Oracle Linux or Ubuntu 22.04 (recommended)
   - **SSH Keys**: 
     - Create or upload your SSH public key
     - Or use Oracle Cloud's generated key (download the .private key file)

3. **Configure Networking**
   - **Virtual Cloud Network**: Create new VCN
   - **Subnet**: Public subnet
   - **Assign Public IP**: Yes

4. **Boot Volume**
   - **Size**: 50 GB (Always Free limit is 200 GB total)

5. **Create Instance**
   - Click "Create"
   - Wait 2-5 minutes for instance to be ready

---

## 🔑 Step 3: Connect to Your Instance

### **For Windows (PuTTY):**
```bash
1. Download PuTTY and PuTTYgen
2. Convert your .private key to .ppk using PuTTYgen
3. Open PuTTY and enter your instance public IP
4. Configure SSH auth with your .ppk key
5. Connect as user: ubuntu (for Ubuntu) or opc (for Oracle Linux)
```

### **For Mac/Linux:**
```bash
# Set proper permissions for SSH key
chmod 600 ~/.ssh/your-private-key

# Connect to instance
ssh -i ~/.ssh/your-private-key ubuntu@YOUR_PUBLIC_IP

# Or for Oracle Linux:
ssh -i ~/.ssh/your-private-key opc@YOUR_PUBLIC_IP
```

---

## 📦 Step 4: Upload Your Application Files

### **Option 1: Using SCP (Mac/Linux)**
```bash
# Copy entire project directory
scp -i ~/.ssh/your-private-key -r /path/to/API-Monitoring-System ubuntu@YOUR_PUBLIC_IP:/tmp/

# SSH into instance
ssh -i ~/.ssh/your-private-key ubuntu@YOUR_PUBLIC_IP

# Move files to project directory
sudo mv /tmp/API-Monitoring-System /opt/
sudo chown -R ubuntu:ubuntu /opt/API-Monitoring-System
```

### **Option 2: Using Git (Recommended)**
```bash
# SSH into instance
ssh -i ~/.ssh/your-private-key ubuntu@YOUR_PUBLIC_IP

# Install git
sudo apt-get update
sudo apt-get install -y git

# Clone your repository
cd /opt
sudo git clone https://github.com/your-username/API-Monitoring-System.git
sudo chown -R ubuntu:ubuntu /opt/API-Monitoring-System
```

---

## 🔧 Step 5: Run Deployment Script

```bash
# SSH into your instance
ssh -i ~/.ssh/your-private-key ubuntu@YOUR_PUBLIC_IP

# Navigate to project directory
cd /opt/API-Monitoring-System

# Make deployment script executable
chmod +x oracle-cloud-deploy.sh

# Run deployment script
sudo ./oracle-cloud-deploy.sh
```

**The script will:**
- Update system packages
- Install Docker and Docker Compose
- Install Nginx and Certbot
- Configure firewall
- Deploy all services
- Set up reverse proxy

---

## 🔒 Step 6: Configure Security

```bash
# Run security configuration script
chmod +x oracle-cloud-security.sh
sudo ./oracle-cloud-security.sh
```

**The script will:**
- Configure UFW firewall
- Harden SSH configuration
- Install fail2ban
- Set up automatic security updates
- Configure Docker security
- Apply system hardening
- Set up security monitoring

---

## 🌐 Step 7: Configure Oracle Cloud Networking

1. **Access VCN Security Lists**
   - Go to Oracle Cloud Console
   - Navigate to "Networking" → "Virtual Cloud Networks"
   - Select your VCN
   - Go to "Security Lists"

2. **Add Ingress Rules**
   ```
   Rule #1:
   - Source: 0.0.0.0/0
   - IP Protocol: TCP
   - Destination Port: 22 (SSH)
   
   Rule #2:
   - Source: 0.0.0.0/0
   - IP Protocol: TCP
   - Destination Port: 80 (HTTP)
   
   Rule #3:
   - Source: 0.0.0.0/0
   - IP Protocol: TCP
   - Destination Port: 443 (HTTPS)
   ```

3. **Optional: Restrict Access**
   - Replace `0.0.0.0/0` with your specific IP for SSH
   - Add rules for specific monitoring ports if needed

---

## ✅ Step 8: Verify Deployment

```bash
# Check running containers
docker ps

# Check service logs
cd /opt/API-Monitoring-System/server
docker-compose logs -f

# Test API health
curl http://localhost:5000/health

# Check Nginx status
sudo systemctl status nginx
```

**Expected Output:**
- All 6 containers should be running
- API should respond to health check
- Nginx should be active

---

## 🔐 Step 9: Setup SSL Certificate (Optional but Recommended)

### **Option 1: Using Domain Name**

```bash
# Update Nginx configuration with your domain
sudo nano /etc/nginx/sites-available/api-monitoring

# Replace 'server_name _;' with 'server_name yourdomain.com;'

# Test Nginx configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx

# Obtain SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Follow the prompts to configure SSL
```

### **Option 2: Using Self-Signed Certificate (Testing Only)**

```bash
# Generate self-signed certificate
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/api-monitoring.key \
  -out /etc/ssl/certs/api-monitoring.crt

# Update Nginx configuration for SSL
sudo nano /etc/nginx/sites-available/api-monitoring
```

---

## 📊 Step 10: Monitor Your Deployment

```bash
# Check system resources
htop

# Check Docker resource usage
docker stats

# View security logs
sudo tail -f /var/log/security-monitor.log

# Check application logs
cd /opt/API-Monitoring-System/server
docker-compose logs -f api-app

# Monitor fail2ban
sudo fail2ban-client status sshd
```

---

## 🎯 Access Your Services

After successful deployment, access your services:

- **API Application**: `http://YOUR_PUBLIC_IP/api/`
- **pgAdmin**: `http://YOUR_PUBLIC_IP/pgadmin/`
- **RabbitMQ Management**: `http://YOUR_PUBLIC_IP/rabbitmq/`

**Default Credentials:**
- **pgAdmin**: admin@example.com / dhruv@123
- **RabbitMQ**: api_user / dhruv@123
- **PostgreSQL**: postgres / dhruv@123

---

## 🔄 Step 11: Set Up Automatic Updates

```bash
# Create update script
cat > /opt/api-monitoring/update.sh << 'EOF'
#!/bin/bash
cd /opt/API-Monitoring-System
git pull origin main
cd server
docker-compose pull
docker-compose up -d
docker system prune -f
EOF

chmod +x /opt/api-monitoring/update.sh

# Add to crontab for daily updates
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/api-monitoring/update.sh >> /var/log/auto-update.log 2>&1") | crontab -
```

---

## 🚨 Troubleshooting

### **Common Issues:**

1. **Out of Memory**
   ```bash
   # Check memory usage
   free -h
   
   # Restart services if needed
   cd /opt/API-Monitoring-System/server
   docker-compose restart
   ```

2. **Docker Won't Start**
   ```bash
   # Check Docker status
   sudo systemctl status docker
   
   # Restart Docker
   sudo systemctl restart docker
   ```

3. **Can't Access Services**
   ```bash
   # Check firewall status
   sudo ufw status
   
   # Check Oracle Cloud security lists
   # Ensure ports 80, 443 are open
   ```

4. **Database Connection Issues**
   ```bash
   # Check database logs
   docker-compose logs postgres
   
   # Restart database
   docker-compose restart postgres
   ```

---

## 📈 Performance Optimization

### **For Limited Resources (1GB RAM):**

1. **Reduce Worker Processes**
   ```bash
   # Update docker-compose.prod.yml
   # Reduce container memory limits
   ```

2. **Enable Swap**
   ```bash
   # Create 2GB swap file
   sudo fallocate -l 2G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   
   # Make swap permanent
   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
   ```

3. **Optimize Database Settings**
   ```bash
   # PostgreSQL tuning
   # Edit postgres configuration in docker-compose
   ```

---

## 🛡️ Security Best Practices

1. **Change Default Passwords**
   - Update all passwords in `.env.production`
   - Use strong, unique passwords

2. **Regular Backups**
   ```bash
   # Backup databases
   docker exec api-monitoring-postgres pg_dump -U postgres api_monitoring > backup.sql
   docker exec api-monitoring-mongo mongodump --db api_monitoring
   ```

3. **Monitor Logs**
   ```bash
   # Regularly check logs for suspicious activity
   sudo tail -f /var/log/auth.log
   sudo tail -f /var/log/security-monitor.log
   ```

4. **Keep System Updated**
   ```bash
   # Regular system updates
   sudo apt-get update && sudo apt-get upgrade -y
   ```

---

## 📞 Support & Resources

- **Oracle Cloud Documentation**: https://docs.oracle.com/en-us/iaas/
- **Docker Documentation**: https://docs.docker.com/
- **Nginx Documentation**: https://nginx.org/en/docs/

---

## 🎉 Congratulations!

Your API Monitoring System is now deployed on Oracle Cloud Always Free tier!

**Next Steps:**
1. Point your domain to the server IP
2. Configure SSL certificates
3. Set up monitoring and alerts
4. Configure regular backups
5. Test all services thoroughly

**Estimated Monthly Cost**: $0 (Always Free tier)

**Resources Used**:
- 1 OCPU, 1GB RAM (out of 4 OCPU, 24GB RAM available)
- ~50GB storage (out of 200GB available)
- You still have resources for another instance!
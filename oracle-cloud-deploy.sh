#!/bin/bash

# Oracle Cloud Deployment Script for API Monitoring System
# This script automates the deployment process on Oracle Cloud Always Free tier

set -e

echo "🚀 Starting Oracle Cloud Deployment for API Monitoring System"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    print_warning "Please run as root or with sudo"
    exit 1
fi

# Update system
print_status "Updating system packages..."
apt-get update && apt-get upgrade -y

# Install essential packages
print_status "Installing essential packages..."
apt-get install -y \
    curl \
    git \
    wget \
    unzip \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release

# Install Docker
print_status "Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    usermod -aG docker ubuntu
    systemctl enable docker
    systemctl start docker
    print_status "Docker installed successfully"
else
    print_status "Docker already installed"
fi

# Install Docker Compose
print_status "Installing Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    print_status "Docker Compose installed successfully"
else
    print_status "Docker Compose already installed"
fi

# Install Nginx for reverse proxy
print_status "Installing Nginx..."
apt-get install -y nginx

# Install Certbot for SSL
print_status "Installing Certbot..."
apt-get install -y certbot python3-certbot-nginx

# Create project directory
print_status "Creating project directory..."
mkdir -p /opt/api-monitoring
cd /opt/api-monitoring

# Clone repository (replace with your actual repo)
print_status "Cloning repository..."
# git clone https://github.com/your-username/API-Monitoring-System.git .
# For now, we'll assume files are copied manually or via git

# Create environment file
print_status "Creating environment file..."
if [ ! -f .env ]; then
    cat > .env << EOF
# Production Environment Variables
NODE_ENV=production
PORT=5000

# PostgreSQL Configuration
POSTGRES_DB=api_monitoring
POSTGRES_USER=postgres
POSTGRES_PASSWORD=dhruv@123

# MongoDB Configuration
MONGO_URI=mongodb://mongo:27017/api_monitoring
MONGO_DB_NAME=api_monitoring

# RabbitMQ Configuration
RABBITMQ_DEFAULT_USER=api_user
RABBITMQ_DEFAULT_PASS=dhruv@123
RABBITMQ_DEFAULT_VHOST=api_monitoring
RABBITMQ_URL=amqp://api_user:dhruv@123@rabbitmq:5672/api_monitoring
RABBITMQ_QUEUE=api_hits

# JWT Configuration
JWT_SECRET=d65f785253c7e523944114b3499e690ffb049fe18f7dbfbf68891f273d02f19e36f799d4266df480e52c3cec6590f85560c199f79bbd78a38bb313a0446e70a4
JWT_EXPIRES_IN=24h

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# pgAdmin Configuration
PGADMIN_DEFAULT_EMAIL=admin@example.com
PGADMIN_DEFAULT_PASSWORD=dhruv@123
EOF
    print_status "Environment file created"
else
    print_status "Environment file already exists"
fi

# Setup firewall
print_status "Configuring firewall..."
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw --force enable

# Create logs directory
print_status "Creating logs directory..."
mkdir -p /opt/api-monitoring/logs
chmod 755 /opt/api-monitoring/logs

# Deploy services with Docker Compose
print_status "Deploying services with Docker Compose..."
cd /opt/api-monitoring/server
docker-compose up -d

# Wait for services to be healthy
print_status "Waiting for services to be healthy..."
sleep 30

# Check service status
print_status "Checking service status..."
docker-compose ps

# Setup Nginx reverse proxy configuration
print_status "Setting up Nginx reverse proxy..."
cat > /etc/nginx/sites-available/api-monitoring << EOF
server {
    listen 80;
    server_name _;

    # API App
    location /api/ {
        proxy_pass http://localhost:5000/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # pgAdmin
    location /pgadmin/ {
        proxy_pass http://localhost:8081/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # RabbitMQ Management
    location /rabbitmq/ {
        proxy_pass http://localhost:15672/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# Enable the site
ln -sf /etc/nginx/sites-available/api-monitoring /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
nginx -t

# Restart Nginx
systemctl restart nginx

print_status "Deployment completed successfully!"
print_status "Services are now running on your Oracle Cloud instance"

echo ""
echo "🎉 Oracle Cloud Deployment Summary:"
echo "=================================="
echo "📡 API App: http://YOUR_PUBLIC_IP/api/"
echo "🗄️  pgAdmin: http://YOUR_PUBLIC_IP/pgadmin/"
echo "🐰 RabbitMQ: http://YOUR_PUBLIC_IP/rabbitmq/"
echo ""
echo "📝 Next Steps:"
echo "1. Point your domain to this server's public IP"
echo "2. Run: certbot --nginx -d yourdomain.com to enable SSL"
echo "3. Update services with your domain name"
echo "4. Monitor logs: docker-compose logs -f"
echo ""
print_warning "Remember to change default passwords in production!"
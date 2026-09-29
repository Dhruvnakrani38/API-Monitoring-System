#!/bin/bash

# Quick Start Script for Oracle Cloud Deployment
# Run this immediately after SSH into your Oracle Cloud instance

set -e

echo "🚀 Oracle Cloud Quick Start - API Monitoring System"
echo "=================================================="

# Update system
echo "📦 Updating system..."
sudo apt-get update && sudo apt-get upgrade -y

# Install Docker
echo "🐳 Installing Docker..."
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
echo "🔧 Installing Docker Compose..."
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Create project directory
echo "📁 Creating project directory..."
sudo mkdir -p /opt/api-monitoring
sudo chown $USER:$USER /opt/api-monitoring

# Clone repository (replace with your repo)
echo "📥 Cloning repository..."
cd /opt/api-monitoring
# git clone https://github.com/your-username/API-Monitoring-System.git .
# For manual upload, upload files to /tmp/ first, then:
# sudo mv /tmp/API-Monitoring-System/* /opt/api-monitoring/

echo "⏳ Manual steps required:"
echo "1. Upload your project files to /opt/api-monitoring/"
echo "2. Navigate to server directory: cd /opt/api-monitoring/server"
echo "3. Run: docker-compose -f docker-compose.prod.yml up -d"
echo "4. Install Nginx: sudo apt-get install -y nginx"
echo "5. Configure reverse proxy"
echo ""
echo "Or run the full deployment script:"
echo "sudo ./oracle-cloud-deploy.sh"

echo "✅ Quick setup completed!"
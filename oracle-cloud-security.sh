#!/bin/bash

# Oracle Cloud Security Configuration Script
# Configures firewall, security rules, and hardening for Oracle Cloud

set -e

echo "🔒 Configuring Security for Oracle Cloud Deployment"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    print_warning "Please run as root or with sudo"
    exit 1
fi

# Configure UFW Firewall
print_status "Configuring UFW Firewall..."

# Reset UFW to default
ufw --force reset

# Set default policies
ufw default deny incoming
ufw default allow outgoing

# Allow SSH (change port if needed)
ufw allow 22/tcp comment 'SSH'

# Allow HTTP and HTTPS
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'

# Allow specific monitoring ports (optional - restrict to your IP)
# ufw allow from YOUR_IP to any port 5000 comment 'API App'
# ufw allow from YOUR_IP to any port 8081 comment 'pgAdmin'
# ufw allow from YOUR_IP to any port 15672 comment 'RabbitMQ'

# Enable firewall
ufw --force enable

print_status "Firewall configured successfully"

# Configure SSH hardening
print_status "Hardening SSH configuration..."

# Backup original SSH config
cp /etc/ssh/sshd_config /etc/ssh/sshd_config.backup

# SSH security settings
cat > /etc/ssh/sshd_config.d/security.conf << EOF
# Security hardening
Port 22
Protocol 2
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
X11Forwarding no
MaxAuthTries 3
ClientAliveInterval 300
ClientAliveCountMax 2
EOF

# Restart SSH service
systemctl restart sshd

print_status "SSH hardening completed"

# Configure fail2ban for SSH protection
print_status "Installing and configuring fail2ban..."

apt-get install -y fail2ban

# Create fail2ban configuration
cat > /etc/fail2ban/jail.local << EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5
destemail = admin@example.com
sendername = Fail2Ban

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
EOF

# Start fail2ban
systemctl enable fail2ban
systemctl start fail2ban

print_status "Fail2ban configured and started"

# Install and configure automatic security updates
print_status "Configuring automatic security updates..."

apt-get install -y unattended-upgrades

# Configure automatic updates
cat > /etc/apt/apt.conf.d/50unattended-upgrades << EOF
Unattended-Upgrade::Allowed-Origins {
    "\${distro_id}:\${distro_codename}-security";
};
Unattended-Upgrade::AutoFixInterruptedDpkg "true";
Unattended-Upgrade::MinimalSteps "true";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
Unattended-Upgrade::Automatic-Reboot-Time "02:00";
EOF

# Enable automatic updates
cat > /etc/apt/apt.conf.d/20auto-upgrades << EOF
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Download-Upgradeable-Packages "1";
APT::Periodic::AutocleanInterval "7";
APT::Periodic::Unattended-Upgrade "1";
EOF

print_status "Automatic security updates configured"

# Configure Docker security
print_status "Configuring Docker security..."

# Create Docker daemon configuration
mkdir -p /etc/docker
cat > /etc/docker/daemon.json << EOF
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "live-restore": true,
  "icc": false,
  "userland-proxy": false,
  "no-new-privileges": true
}
EOF

# Restart Docker
systemctl restart docker

print_status "Docker security configured"

# Configure system hardening
print_status "Applying system hardening..."

# Disable unused filesystems
echo "install cramfs /bin/true" >> /etc/modprobe.d/disable-filesystems.conf
echo "install freevxfs /bin/true" >> /etc/modprobe.d/disable-filesystems.conf
echo "install jffs2 /bin/true" >> /etc/modprobe.d/disable-filesystems.conf
echo "install hfsplus /bin/true" >> /etc/modprobe.d/disable-filesystems.conf
echo "install squashfs /bin/true" >> /etc/modprobe.d/disable-filesystems.conf
echo "install udf /bin/true" >> /etc/modprobe.d/disable-filesystems.conf

# Secure shared memory
echo "tmpfs /run/shm tmpfs defaults,noexec,nosuid,nodev 0 0" >> /etc/fstab

print_status "System hardening applied"

# Install log monitoring
print_status "Installing log monitoring tools..."

apt-get install -y logrotate

# Create logrotate configuration for application logs
cat > /etc/logrotate.d/api-monitoring << EOF
/opt/api-monitoring/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0640 ubuntu ubuntu
}
EOF

print_status "Log monitoring configured"

# Create security monitoring script
print_status "Creating security monitoring script..."

cat > /usr/local/bin/security-monitor.sh << 'EOF'
#!/bin/bash
# Security monitoring script

LOG_FILE="/var/log/security-monitor.log"
DATE=$(date '+%Y-%m-%d %H:%M:%S')

# Check disk usage
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    echo "[$DATE] WARNING: Disk usage is ${DISK_USAGE}%" >> $LOG_FILE
fi

# Check memory usage
MEM_USAGE=$(free | awk 'NR==2 {printf "%.0f", $3/$2 * 100}')
if [ $MEM_USAGE -gt 90 ]; then
    echo "[$DATE] WARNING: Memory usage is ${MEM_USAGE}%" >> $LOG_FILE
fi

# Check Docker container status
DOCKER_STATUS=$(docker ps --format "{{.Status}}" | grep -c "Up")
if [ $DOCKER_STATUS -lt 5 ]; then
    echo "[$DATE] WARNING: Only $DOCKER_STATUS containers running" >> $LOG_FILE
fi

# Check failed SSH attempts
FAILED_SSH=$(grep "Failed password" /var/log/auth.log | wc -l)
if [ $FAILED_SSH -gt 10 ]; then
    echo "[$DATE] WARNING: $FAILED_SSH failed SSH attempts detected" >> $LOG_FILE
fi
EOF

chmod +x /usr/local/bin/security-monitor.sh

# Add to crontab
(crontab -l 2>/dev/null; echo "*/30 * * * * /usr/local/bin/security-monitor.sh") | crontab -

print_status "Security monitoring configured"

print_status "Security configuration completed successfully!"
echo ""
echo "🔒 Security Summary:"
echo "=================="
echo "✅ UFW Firewall configured"
echo "✅ SSH hardening applied"
echo "✅ Fail2ban installed and configured"
echo "✅ Automatic security updates enabled"
echo "✅ Docker security configured"
echo "✅ System hardening applied"
echo "✅ Log monitoring configured"
echo "✅ Security monitoring script created"
echo ""
print_warning "Remember to:"
echo "1. Set up SSH keys for authentication"
echo "2. Configure your IP address in firewall rules if needed"
echo "3. Regularly check /var/log/security-monitor.log"
echo "4. Keep system updated"
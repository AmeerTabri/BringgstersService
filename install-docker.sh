#!/bin/bash

# Exit on error
set -e

echo "[1/6] Updating packages and installing prerequisites..."
sudo apt update
sudo apt install ca-certificates curl gnupg lsb-release -y

echo "[2/6] Adding Docker’s official GPG key..."
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

echo "[3/6] Setting up the Docker repository..."
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

echo "[4/6] Installing Docker Engine, CLI, and Compose plugin..."
sudo apt update
sudo apt install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin -y

echo "[5/6] Adding user '$USER' to docker group..."
sudo groupadd docker || true
sudo usermod -aG docker $USER

echo "[6/6] Enabling Docker to start automatically in WSL..."
sudo mkdir -p /etc/wsl
echo "[boot]" | sudo tee /etc/wsl.conf > /dev/null
echo "command=\"service docker start\"" | sudo tee -a /etc/wsl.conf > /dev/null

echo ""
echo "✅ Docker installed successfully."
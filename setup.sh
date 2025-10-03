#!/bin/bash

# Blockchain Indexer Setup Script

set -e

echo "🚀 Blockchain Indexer Setup"
echo "============================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 20+ first."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "❌ Node.js version must be 20 or higher. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Check if Docker is installed
if command -v docker &> /dev/null; then
    echo "✅ Docker detected"
    DOCKER_AVAILABLE=true
else
    echo "⚠️  Docker not found. You'll need to set up PostgreSQL manually."
    DOCKER_AVAILABLE=false
fi

echo ""
echo "Installing dependencies..."
npm install

echo ""
echo "Setting up environment..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "✅ Created .env file from .env.example"
else
    echo "✅ .env file already exists"
fi

echo ""
echo "Setup Options:"
echo "1. Run with Docker Compose (recommended - includes PostgreSQL)"
echo "2. Run locally (requires PostgreSQL to be set up separately)"
echo ""
read -p "Choose an option (1 or 2): " choice

case $choice in
    1)
        if [ "$DOCKER_AVAILABLE" = false ]; then
            echo "❌ Docker is required for this option but not installed."
            exit 1
        fi
        
        echo ""
        echo "Starting services with Docker Compose..."
        docker-compose up -d
        
        echo ""
        echo "⏳ Waiting for services to be ready..."
        sleep 5
        
        echo ""
        echo "✅ Setup complete!"
        echo ""
        echo "📝 Your services are running:"
        echo "   - API: http://localhost:3000"
        echo "   - PostgreSQL: localhost:5432"
        echo ""
        echo "📚 Useful commands:"
        echo "   - View logs: docker-compose logs -f api"
        echo "   - Stop services: docker-compose down"
        echo "   - Restart: docker-compose restart"
        echo ""
        ;;
    2)
        echo ""
        echo "⚠️  Make sure PostgreSQL is running and accessible"
        echo ""
        echo "Default connection string in .env:"
        echo "DATABASE_URL=postgresql://postgres:postgres@localhost:5432/blockchain_indexer"
        echo ""
        read -p "Is PostgreSQL ready? (y/n): " pg_ready
        
        if [ "$pg_ready" != "y" ]; then
            echo ""
            echo "Please set up PostgreSQL first, then run:"
            echo "  npm run dev"
            exit 0
        fi
        
        echo ""
        echo "Starting development server..."
        npm run dev
        ;;
    *)
        echo "Invalid option. Please run the script again."
        exit 1
        ;;
esac
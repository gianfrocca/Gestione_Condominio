#!/bin/bash
set -e

echo "🔨 Building Gestione Condominio..."

# Build backend
echo "📦 Installing backend dependencies..."
cd backend
npm ci --production --prefer-offline --no-audit
cd ..

# Build frontend
echo "⚛️  Building frontend..."
cd frontend
npm ci --prefer-offline --no-audit
npm run build
cd ..

echo "✅ Build completed successfully!"

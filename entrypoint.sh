#!/bin/sh
# Entrypoint script for Gestione Condominio
# Ensures data directories exist and are writable

echo "🔧 Initializing application..."

# Create data directories
mkdir -p /app/data/storage
mkdir -p /app/data/backups
mkdir -p /app/data/bills
mkdir -p /app/data/reports

# Set permissions
chmod -R 755 /app/data

# Verify directories are writable
if [ ! -w /app/data ]; then
  echo "⚠️ Warning: /app/data is not writable. Data will be lost on container restart."
  echo "📋 Please configure Persistent Storage in Coolify:"
  echo "   Configuration → Persistent Storage → Add → /app/data"
else
  echo "✅ Data directory is writable and persistent"
fi

# Start the application
echo "🚀 Starting Gestione Condominio..."
exec node backend/server.js

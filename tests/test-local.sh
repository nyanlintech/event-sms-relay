#!/bin/bash

# Local testing script for Event SMS Relay

echo "🧪 Testing Event SMS Relay locally with SAM"
echo "============================================"

# Check if SAM is installed
if ! command -v sam &> /dev/null; then
    echo "❌ SAM CLI not found. Please install it first."
    exit 1
fi

# Change to project root directory
cd "$(dirname "$0")/.."

# Build the application
echo "📦 Building SAM application..."
sam build

# Start local API
echo "🚀 Starting local API server..."
echo "API will be available at: http://localhost:3000"
echo ""
echo "📋 Available endpoints:"
echo "  POST http://localhost:3000/process        - Process guest data"
echo "  GET  http://localhost:3000/guests         - Get all guests"
echo "  GET  http://localhost:3000/guests/summary - Get guest summary"
echo ""
echo "🛑 Press Ctrl+C to stop the server"
echo ""

sam local start-api
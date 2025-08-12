#!/bin/bash

echo "Starting services..."

# Start hagmonia worker
node hagmonia.js &
echo "✅ hagmonia.js started"

# Start bringgster API
node bringgster.js &
echo "✅ bringgster.js started"

echo "🎉 Both services are running!"

wait

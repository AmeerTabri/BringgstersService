#!/bin/bash

npx tsc 

node bringgster.js &
echo "✅ bringgster.js started"

node hagmonia.js &
echo "✅ hagmonia.js started"

echo "🎉 Both services are running!"

wait
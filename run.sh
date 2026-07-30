#!/bin/bash

# Navigate to the correct directory just in case
cd "$(dirname "$0")"

echo "Starting PickoShifts in Development Mode..."
echo "Installing any missing dependencies (if needed)..."
npm install --silent

echo "Starting server..."
npm run dev -- --open

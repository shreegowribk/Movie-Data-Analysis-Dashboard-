#!/usr/bin/env bash
# CineMetrics Flask Application Startup Script

cd "$(dirname "$0")"

if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
    ./venv/bin/pip install -r requirements.txt
fi

echo "🎬 Starting CineMetrics Flask Web Application..."
echo "📊 Accessible at: http://localhost:5001"
PORT=5001 ./venv/bin/python app.py

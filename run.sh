#!/bin/bash

# Function to trap Ctrl+C and kill both Python and bun processes
trap 'kill $(jobs -p); echo "Exiting..."; exit' INT

# Check if pip is installed
if ! command -v pip &>/dev/null; then
    echo "pip is not installed. Please install it using:"
    echo "sudo apt install python3-pip"
    exit 1
fi

# Check if bun is installed
if ! command -v bun &>/dev/null; then
    echo "bun is not installed. Please install it using:"
    echo "sudo apt install bun"
    exit 1
fi

# Check if Python is installed
if ! command -v python3 &>/dev/null; then
    echo "Python is not installed. Please install it using:"
    echo "sudo apt install python3"
    exit 1
fi

if ! [ -f .flag ]; then
    read -p "Would you like to install dependencies? (yes/no): " install_deps

    if [[ "$install_deps" == "yes" || "$install_deps" == "Yes" ]]; then
        # Install Python dependencies
        pip install -r requirements.txt

        # Install Node.js dependencies
        bun install -D tailwindcss
    fi

    echo "First launch flag" >.flag
fi

git pull
# Determine whether to run app.py or flask run based on argument
if [ "$1" == "prod" ]; then
    echo "Running in production mode"
    python3 -m gunicorn --bind 0.0.0.0:5893 --timeout 120 app:app &
else
    echo "Running in dev mode"
    flask --debug run &
fi

bun run build &

wait

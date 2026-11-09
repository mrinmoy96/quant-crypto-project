#!/usr/bin/env bash
# Exit on error
set -o errexit -o nounset -o pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

# Install backend dependencies
echo "Installing backend dependencies..."
cd backend
npm install
cd ..

# Compile the C++ quant engine
echo "Building C++ trading engine..."
cd engine
mkdir -p build
cd build
cmake ..
cmake --build .
cd ../..

echo "Build complete!"
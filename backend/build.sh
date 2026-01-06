#!/bin/bash
# Build script for Lambda functions
# Packages each function with shared utilities and dependencies

set -e

BACKEND_DIR="$(cd "$(dirname "$0")" && pwd)"
FUNCTIONS_DIR="$BACKEND_DIR/functions"
SHARED_DIR="$BACKEND_DIR/shared"
NODE_MODULES_DIR="$BACKEND_DIR/node_modules"

echo "Building Lambda functions..."

# Install dependencies if node_modules doesn't exist
if [ ! -d "$NODE_MODULES_DIR" ]; then
  echo "Installing dependencies..."
  cd "$BACKEND_DIR"
  npm install
fi

# Build each function
for func_dir in "$FUNCTIONS_DIR"/*/*; do
  if [ -d "$func_dir" ] && [ -f "$func_dir"/*.js ]; then
    func_name=$(basename "$func_dir")
    func_type=$(basename "$(dirname "$func_dir")")
    
    echo "Building $func_type/$func_name..."
    
    # Create a temporary build directory
    BUILD_DIR="$func_dir/.build"
    rm -rf "$BUILD_DIR"
    mkdir -p "$BUILD_DIR"
    
    # Copy function file(s)
    cp "$func_dir"/*.js "$BUILD_DIR/" 2>/dev/null || true
    
    # Copy shared utilities
    mkdir -p "$BUILD_DIR/shared"
    cp -r "$SHARED_DIR"/* "$BUILD_DIR/shared/"
    
    # Copy node_modules (or create symlink for smaller packages)
    # For production, you might want to use a bundler like esbuild
    # For now, we'll copy node_modules
    if [ -d "$NODE_MODULES_DIR" ]; then
      cp -r "$NODE_MODULES_DIR" "$BUILD_DIR/" 2>/dev/null || true
    fi
    
    # Create zip file
    cd "$BUILD_DIR"
    zip -r "../${func_name}.zip" . -q
    cd - > /dev/null
    
    echo "  ✓ Created $func_type/$func_name.zip"
  fi
done

echo "Build complete!"


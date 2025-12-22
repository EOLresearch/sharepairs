#!/bin/bash
# Build script to package Lambda functions with shared dependencies

set -e

BACKEND_DIR="$(cd "$(dirname "$0")" && pwd)"
FUNCTIONS_DIR="$BACKEND_DIR/functions"
SHARED_DIR="$BACKEND_DIR/shared"
BUILD_DIR="$BACKEND_DIR/.build"

# Clean build directory
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Install dependencies
echo "Installing dependencies..."
cd "$BACKEND_DIR"
npm install --production

# Package each function
package_function() {
  local function_dir=$1
  local function_name=$2
  local handler_file=$3
  
  echo "Packaging $function_name..."
  
  # Create temp directory for this function
  local temp_dir="$BUILD_DIR/$function_name"
  mkdir -p "$temp_dir"
  
  # Copy function file
  cp "$function_dir/$handler_file" "$temp_dir/"
  
  # Copy shared directory
  cp -r "$SHARED_DIR" "$temp_dir/shared"
  
  # Copy node_modules (only production dependencies)
  cp -r "$BACKEND_DIR/node_modules" "$temp_dir/" 2>/dev/null || true
  
  # Update require paths in function file to use ./shared
  # (Functions should already use relative paths like ../../shared)
  
  # Create zip
  cd "$temp_dir"
  zip -r "$function_dir/${handler_file%.js}.zip" . -q
  cd "$BACKEND_DIR"
  
  echo "  ✓ Created ${handler_file%.js}.zip"
}

# Package auth functions
package_function "$FUNCTIONS_DIR/auth" "auth_register" "register.js"
package_function "$FUNCTIONS_DIR/auth" "auth_login" "login.js"
package_function "$FUNCTIONS_DIR/auth" "auth_refresh" "refresh.js"
package_function "$FUNCTIONS_DIR/auth" "auth_forgot_password" "forgot-password.js"
package_function "$FUNCTIONS_DIR/auth" "auth_reset_password" "reset-password.js"

# Package users functions
package_function "$FUNCTIONS_DIR/users" "users_get_me" "get-me.js"
package_function "$FUNCTIONS_DIR/users" "users_update_me" "update-me.js"
package_function "$FUNCTIONS_DIR/users" "users_get_by_id" "get-by-id.js"

# Package messages functions
package_function "$FUNCTIONS_DIR/messages" "messages_get_conversations" "get-conversations.js"
package_function "$FUNCTIONS_DIR/messages" "messages_get_messages" "get-messages.js"
package_function "$FUNCTIONS_DIR/messages" "messages_send_message" "send-message.js"

# Package files functions
package_function "$FUNCTIONS_DIR/files" "files_upload" "upload.js"
package_function "$FUNCTIONS_DIR/files" "files_get" "get.js"
package_function "$FUNCTIONS_DIR/files" "files_delete" "delete.js"

# Package distress functions
package_function "$FUNCTIONS_DIR/distress" "distress_send_alert" "send-alert.js"

echo ""
echo "✓ All functions packaged successfully!"
echo "  Zip files are in: $FUNCTIONS_DIR/*/*.zip"


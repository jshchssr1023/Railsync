#!/bin/bash
# Generate self-signed TLS certificates for local development.
# For production, use Let's Encrypt or your organization's CA.

CERT_DIR="$(dirname "$0")/certs"
mkdir -p "$CERT_DIR"

if [ -f "$CERT_DIR/server.crt" ] && [ -f "$CERT_DIR/server.key" ]; then
  echo "Certificates already exist in $CERT_DIR"
  echo "Delete them first if you want to regenerate."
  exit 0
fi

openssl req -x509 -nodes -days 365 \
  -newkey rsa:2048 \
  -keyout "$CERT_DIR/server.key" \
  -out "$CERT_DIR/server.crt" \
  -subj "/C=US/ST=Local/L=Dev/O=RailSync/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

echo "Self-signed certificates generated in $CERT_DIR"
echo ""
echo "WARNING: These are for development only."
echo "For production, use Let's Encrypt or your organization's certificate authority."

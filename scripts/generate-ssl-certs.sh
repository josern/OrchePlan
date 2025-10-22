#!/bin/bash
# SSL Certificate Generation for PostgreSQL
# This script generates self-signed certificates for development

set -e

CERT_DIR="./certs"
mkdir -p "$CERT_DIR"

echo "🔐 Generating SSL certificates for PostgreSQL..."

# Generate CA private key
openssl genrsa -out "$CERT_DIR/ca-key.pem" 4096

# Generate CA certificate
openssl req -new -x509 -days 365 -key "$CERT_DIR/ca-key.pem" -out "$CERT_DIR/ca-cert.pem" \
  -subj "/C=US/ST=CA/L=San Francisco/O=OrchePlan/OU=Development/CN=OrchePlan-CA"

# Generate server private key
openssl genrsa -out "$CERT_DIR/server-key.pem" 4096

# Generate server certificate signing request
openssl req -new -key "$CERT_DIR/server-key.pem" -out "$CERT_DIR/server.csr" \
  -subj "/C=US/ST=CA/L=San Francisco/O=OrchePlan/OU=Development/CN=localhost"

# Generate server certificate signed by CA
openssl x509 -req -days 365 -in "$CERT_DIR/server.csr" -CA "$CERT_DIR/ca-cert.pem" \
  -CAkey "$CERT_DIR/ca-key.pem" -CAcreateserial -out "$CERT_DIR/server-cert.pem"

# Generate client private key
openssl genrsa -out "$CERT_DIR/client-key.pem" 4096

# Generate client certificate signing request
openssl req -new -key "$CERT_DIR/client-key.pem" -out "$CERT_DIR/client.csr" \
  -subj "/C=US/ST=CA/L=San Francisco/O=OrchePlan/OU=Development/CN=postgres"

# Generate client certificate signed by CA
openssl x509 -req -days 365 -in "$CERT_DIR/client.csr" -CA "$CERT_DIR/ca-cert.pem" \
  -CAkey "$CERT_DIR/ca-key.pem" -CAcreateserial -out "$CERT_DIR/client-cert.pem"

# Set proper permissions
chmod 600 "$CERT_DIR"/*.pem
chmod 600 "$CERT_DIR"/*.key

# Clean up CSR files
rm -f "$CERT_DIR"/*.csr "$CERT_DIR"/*.srl

echo "✅ SSL certificates generated in $CERT_DIR/"
echo ""
echo "Files created:"
echo "  📄 ca-cert.pem      - Certificate Authority (for sslrootcert)"
echo "  🔑 ca-key.pem       - CA private key (keep secure)"
echo "  📄 server-cert.pem  - Server certificate"
echo "  🔑 server-key.pem   - Server private key"
echo "  📄 client-cert.pem  - Client certificate (for sslcert)"
echo "  🔑 client-key.pem   - Client private key (for sslkey)"
echo ""
echo "💡 Update your DATABASE_URL to use SSL:"
echo "   postgresql://user:pass@localhost:5432/db?sslmode=verify-full&sslcert=./certs/client-cert.pem&sslkey=./certs/client-key.pem&sslrootcert=./certs/ca-cert.pem"
echo ""
echo "🐳 For Docker, copy certificates to PostgreSQL container:"
echo "   docker cp ./certs/server-cert.pem container:/var/lib/postgresql/server.crt"
echo "   docker cp ./certs/server-key.pem container:/var/lib/postgresql/server.key"
echo "   docker cp ./certs/ca-cert.pem container:/var/lib/postgresql/ca.crt"
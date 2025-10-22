#!/bin/bash
# Production SSL Configuration for Database Connections

# This script helps configure SSL for various cloud providers

echo "🔐 Database SSL Configuration Helper"
echo ""

# Function to display cloud provider SSL configurations
show_cloud_config() {
    case $1 in
        "aws")
            echo "🌩️  AWS RDS SSL Configuration:"
            echo "DATABASE_URL='postgresql://username:password@your-rds-endpoint.region.rds.amazonaws.com:5432/database?sslmode=require'"
            echo ""
            echo "For additional security, download RDS CA certificate:"
            echo "wget https://s3.amazonaws.com/rds-downloads/rds-ca-2019-root.pem"
            echo "DATABASE_URL='postgresql://username:password@endpoint:5432/db?sslmode=verify-full&sslrootcert=rds-ca-2019-root.pem'"
            ;;
        "gcp")
            echo "☁️  Google Cloud SQL SSL Configuration:"
            echo "1. Download client certificates from Cloud Console"
            echo "2. Set environment variables:"
            echo "DATABASE_URL='postgresql://username:password@ip:5432/database?sslmode=verify-full&sslcert=client-cert.pem&sslkey=client-key.pem&sslrootcert=server-ca.pem'"
            ;;
        "digitalocean")
            echo "🌊 Digital Ocean Managed Database SSL:"
            echo "DATABASE_URL='postgresql://username:password@hostname:25060/database?sslmode=require'"
            echo ""
            echo "Download CA certificate from Digital Ocean control panel"
            echo "DATABASE_URL='postgresql://username:password@hostname:25060/database?sslmode=verify-full&sslrootcert=ca-certificate.crt'"
            ;;
        "heroku")
            echo "🟣 Heroku Postgres SSL (automatic):"
            echo "DATABASE_URL='postgresql://username:password@hostname:5432/database?sslmode=require'"
            echo "Note: Heroku automatically handles SSL certificates"
            ;;
        "azure")
            echo "🔷 Azure Database for PostgreSQL:"
            echo "DATABASE_URL='postgresql://username:password@hostname.postgres.database.azure.com:5432/database?sslmode=require'"
            echo ""
            echo "Download DigiCert Global Root CA:"
            echo "wget https://www.digicert.com/CACerts/DigiCertGlobalRootCA.crt.pem"
            echo "DATABASE_URL='postgresql://username:password@hostname:5432/database?sslmode=verify-full&sslrootcert=DigiCertGlobalRootCA.crt.pem'"
            ;;
        *)
            echo "❓ Unknown provider. Available options:"
            echo "  aws, gcp, digitalocean, heroku, azure"
            ;;
    esac
}

# Check command line argument
if [ $# -eq 0 ]; then
    echo "Usage: $0 [aws|gcp|digitalocean|heroku|azure]"
    echo ""
    echo "Examples:"
    echo "  $0 aws         # Show AWS RDS SSL configuration"
    echo "  $0 gcp         # Show Google Cloud SQL configuration"
    echo "  $0 digitalocean # Show Digital Ocean configuration"
    echo "  $0 heroku      # Show Heroku configuration"
    echo "  $0 azure       # Show Azure configuration"
    exit 1
fi

show_cloud_config $1

echo ""
echo "📋 General SSL Security Levels:"
echo "  sslmode=disable     ❌ No encryption (NOT recommended)"
echo "  sslmode=allow       ⚠️  Try SSL, fallback to plain"
echo "  sslmode=prefer      ⚠️  Prefer SSL, fallback to plain"
echo "  sslmode=require     ✅ Require SSL (basic encryption)"
echo "  sslmode=verify-ca   ✅ Require SSL + verify CA"
echo "  sslmode=verify-full ✅ Require SSL + verify hostname"
echo ""
echo "🔒 For production, use 'require' minimum, 'verify-full' recommended"
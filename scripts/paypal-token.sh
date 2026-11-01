#!/usr/bin/env bash
# scripts/paypal-token.sh
# Prints a fresh PayPal Sandbox OAuth access token using credentials from .env

set -euo pipefail

ENV_FILE=".env"
if [ ! -f "$ENV_FILE" ]; then
  echo "Error: .env file not found." >&2
  exit 1
fi

# Extract CLIENT_ID and CLIENT_SECRET from .env
CLIENT_ID=$(grep -E '^PAYPAL_CLIENT_ID=' "$ENV_FILE" | cut -d '=' -f2- | tr -d '\r"')
CLIENT_SECRET=$(grep -E '^PAYPAL_CLIENT_SECRET=' "$ENV_FILE" | cut -d '=' -f2- | tr -d '\r"')

if [ -z "$CLIENT_ID" ] || [ -z "$CLIENT_SECRET" ]; then
  echo "Error: PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET is missing in .env" >&2
  exit 1
fi

RESPONSE=$(curl -s -S -X POST "https://api-m.sandbox.paypal.com/v1/oauth2/token" \
  -H "Accept: application/json" \
  -H "Accept-Language: en_US" \
  -u "${CLIENT_ID}:${CLIENT_SECRET}" \
  -d "grant_type=client_credentials")

# Check if access_token exists in response
if echo "$RESPONSE" | grep -q '"access_token"'; then
  # Extract token without external tools like jq if possible
  TOKEN=$(echo "$RESPONSE" | sed -n 's/.*"access_token": *"\([^"]*\)".*/\1/p')
  echo "$TOKEN"
else
  echo "Error generating access token: $RESPONSE" >&2
  exit 1
fi


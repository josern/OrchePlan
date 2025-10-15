#!/bin/bash
set -euo pipefail

HOST=${HOST:-http://localhost:3000}

echo "Waiting 1s for server..."
sleep 1

echo "1) Create or login owner user (owner@example.com)"
owner_signup_resp=$(curl -s -X POST "$HOST/auth/signup" -H "Content-Type: application/json" -d '{"email":"owner@example.com","password":"ownerpass","name":"Owner"}')
owner_token=$(echo "$owner_signup_resp" | jq -r '.token // empty')
if [[ -z "$owner_token" ]]; then
  echo "Signup didn't return token (user may already exist), attempting login..."
  owner_token=$(curl -s -X POST "$HOST/auth/login" -H "Content-Type: application/json" -d '{"email":"owner@example.com","password":"ownerpass"}' | jq -r '.token // empty')
fi
if [[ -z "$owner_token" ]]; then
  echo "Failed to obtain owner token"; echo "server response: $owner_signup_resp"; exit 1
fi
echo "Owner token received"

echo "2) Create or login member user (member@example.com)"
member_signup_resp=$(curl -s -X POST "$HOST/auth/signup" -H "Content-Type: application/json" -d '{"email":"member@example.com","password":"memberpass","name":"Member"}')
member_token=$(echo "$member_signup_resp" | jq -r '.token // empty')
if [[ -z "$member_token" ]]; then
  echo "Signup didn't return token (user may already exist), attempting login..."
  member_token=$(curl -s -X POST "$HOST/auth/login" -H "Content-Type: application/json" -d '{"email":"member@example.com","password":"memberpass"}' | jq -r '.token // empty')
fi
if [[ -z "$member_token" ]]; then
  echo "Failed to obtain member token"; echo "server response: $member_signup_resp"; exit 1
fi
echo "Member token received"

echo "3) Owner creates a project"
project=$(curl -s -X POST "$HOST/projects" -H "Content-Type: application/json" -H "Authorization: Bearer $owner_token" -d '{"name":"Owner Project","description":"Project for member flow"}' | jq -r '.id')
if [[ -z "$project" || "$project" == "null" ]]; then
  echo "Failed to create project"; exit 1
fi
echo "Project created: $project"

echo "4) Determine member user id"
member_id=$(curl -s -X POST "$HOST/auth/login" -H "Content-Type: application/json" -d '{"email":"member@example.com","password":"memberpass"}' | jq -r '.user.id')
if [[ -z "$member_id" || "$member_id" == "null" ]]; then
  echo "Failed to determine member id"; exit 1
fi
echo "Member id: $member_id"

echo "5) Owner invites member as editor"
invite=$(curl -s -X POST "$HOST/projects/$project/members" -H "Content-Type: application/json" -H "Authorization: Bearer $owner_token" -d "{\"userId\":\"$member_id\",\"role\":\"editor\"}")
echo "Invite response: $invite"

echo "5) List members as owner"
curl -s -X GET "$HOST/projects/$project/members" -H "Authorization: Bearer $owner_token" | jq


echo "6) Change member role to viewer"
curl -s -X PUT "$HOST/projects/$project/members/$member_id" -H "Authorization: Bearer $owner_token" -H "Content-Type: application/json" -d '{"role":"viewer"}' | jq

echo "7) Remove member"
curl -s -X DELETE "$HOST/projects/$project/members/$member_id" -H "Authorization: Bearer $owner_token" -o /dev/null -w "%{http_code}\n"

echo "Member flow smoke test finished."

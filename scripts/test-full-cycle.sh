#!/bin/bash
set -e

BASE_URL="http://localhost:3005/api/v1"

echo "=== MASIHOLISANE FULL CYCLE TEST ==="
echo ""

# Get tokens
echo "1. Getting tokens..."
TOKEN=$(curl -s -X POST $BASE_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"thabo@masiholisane.co.za","password":"Password123!"}' | jq -r '.data.token')

TOKEN_NOMSA=$(curl -s -X POST $BASE_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"nomsa@masiholisane.co.za","password":"Password123!"}' | jq -r '.data.token')

TOKEN_ZANELE=$(curl -s -X POST $BASE_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"zanele@masiholisane.co.za","password":"Password123!"}' | jq -r '.data.token')

echo "   Thabo:  ${TOKEN:0:15}..."
echo "   Nomsa:  ${TOKEN_NOMSA:0:15}..."
echo "   Zanele: ${TOKEN_ZANELE:0:15}..."
echo ""

# Join pool
echo "2. Joining pool..."
R1=$(curl -s -X POST $BASE_URL/stokvels/join \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tier": 1}')
echo "   Thabo:  $(echo $R1 | jq -r '.data.groupStatus')"

R2=$(curl -s -X POST $BASE_URL/stokvels/join \
  -H "Authorization: Bearer $TOKEN_NOMSA" \
  -H "Content-Type: application/json" \
  -d '{"tier": 1}')
echo "   Nomsa:  $(echo $R2 | jq -r '.data.groupStatus')"

R3=$(curl -s -X POST $BASE_URL/stokvels/join \
  -H "Authorization: Bearer $TOKEN_ZANELE" \
  -H "Content-Type: application/json" \
  -d '{"tier": 1}')
echo "   Zanele: $(echo $R3 | jq -r '.data.groupStatus')"

GROUP_ID=$(echo $R3 | jq -r '.data.groupId')
echo "   Group ID: $GROUP_ID"
echo ""

if [ "$GROUP_ID" = "null" ] || [ -z "$GROUP_ID" ]; then
  echo "ERROR: Group ID is null. Check service logs."
  exit 1
fi

# Check balances after deposits
echo "3. Balances after security deposits:"
docker exec masi_postgres psql -U masi_user -d masiholisane_db -t -c \
  "SELECT '   ' || u.name || ': R' || (a.balance/100.0)::numeric(10,2) FROM \"Account\" a JOIN \"User\" u ON a.\"userId\" = u.id ORDER BY u.name;"
echo ""

# Run all 3 cycles
for CYCLE in 1 2 3; do
  echo "4. Cycle $CYCLE contributions..."

  M1=$(curl -s -X POST $BASE_URL/stokvels/$GROUP_ID/contribute \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json")
  echo "   Thabo:  $(echo $M1 | jq -r '.message')"

  M2=$(curl -s -X POST $BASE_URL/stokvels/$GROUP_ID/contribute \
    -H "Authorization: Bearer $TOKEN_NOMSA" \
    -H "Content-Type: application/json")
  echo "   Nomsa:  $(echo $M2 | jq -r '.message')"

  M3=$(curl -s -X POST $BASE_URL/stokvels/$GROUP_ID/contribute \
    -H "Authorization: Bearer $TOKEN_ZANELE" \
    -H "Content-Type: application/json")
  echo "   Zanele: $(echo $M3 | jq -r '.message')"
  echo ""
done

# Final balances
echo "5. Final balances (deposits should be returned):"
docker exec masi_postgres psql -U masi_user -d masiholisane_db -t -c \
  "SELECT '   ' || u.name || ': R' || (a.balance/100.0)::numeric(10,2) FROM \"Account\" a JOIN \"User\" u ON a.\"userId\" = u.id ORDER BY u.name;"
echo ""

# Group status
echo "6. Group status:"
curl -s $BASE_URL/stokvels/$GROUP_ID \
  -H "Authorization: Bearer $TOKEN" | jq '{
    status: .data.group.status,
    members: [.data.group.members[] | {name: .user.name, status}],
    escrow: {
      securityFund: .data.group.escrow.securityFund,
      released: .data.group.escrow.released
    }
  }'

echo ""
echo "=== TEST COMPLETE ==="

#!/bin/bash
BASE="http://localhost:3005/api/v1"

echo "=== DROPOUT SCENARIO TEST ==="
echo ""

# ── 1. Tokens ─────────────────────────────────────────────────────────────────
echo "1. Getting tokens..."
T1=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" -d '{"email":"thabo@masiholisane.co.za","password":"Password123!"}' | jq -r '.data.token')
T2=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" -d '{"email":"nomsa@masiholisane.co.za","password":"Password123!"}' | jq -r '.data.token')
T3=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" -d '{"email":"zanele@masiholisane.co.za","password":"Password123!"}' | jq -r '.data.token')
echo "   Tokens: ${T1:0:10}... ${T2:0:10}... ${T3:0:10}..."

# ── 2. Join pool ──────────────────────────────────────────────────────────────
echo ""
echo "2. Joining pool..."
J1=$(curl -s -X POST "$BASE/stokvels/join" -H "Authorization: Bearer $T1" -H "Content-Type: application/json" -d '{"tier":1}')
echo "   Thabo:  $(echo $J1 | jq -r '.data.groupStatus // .message')"

J2=$(curl -s -X POST "$BASE/stokvels/join" -H "Authorization: Bearer $T2" -H "Content-Type: application/json" -d '{"tier":1}')
echo "   Nomsa:  $(echo $J2 | jq -r '.data.groupStatus // .message')"

J3=$(curl -s -X POST "$BASE/stokvels/join" -H "Authorization: Bearer $T3" -H "Content-Type: application/json" -d '{"tier":1}')
GID=$(echo $J3 | jq -r '.data.groupId')
echo "   Zanele: $(echo $J3 | jq -r '.data.groupStatus // .message')"
echo "   Group:  $GID"

if [ "$GID" = "null" ] || [ -z "$GID" ]; then
  echo ""
  echo "Full Zanele response:"
  echo $J3 | jq .
  exit 1
fi

# ── 3. Balances after deposits ────────────────────────────────────────────────
echo ""
echo "3. Balances after security deposits (R500 each):"
docker exec masi_postgres psql -U masi_user -d masiholisane_db -t -c "SELECT '   ' || u.name || ': R' || (a.balance/100.0)::numeric(10,2) FROM \"Account\" a JOIN \"User\" u ON a.\"userId\" = u.id ORDER BY u.name;"

# ── 4. Drain Thabo ────────────────────────────────────────────────────────────
THABO_ID=$(docker exec masi_postgres psql -U masi_user -d masiholisane_db -t -c "SELECT id FROM \"User\" WHERE email='thabo@masiholisane.co.za';" | tr -d ' \n')
echo ""
echo "4. Draining Thabo wallet..."
docker exec masi_postgres psql -U masi_user -d masiholisane_db -c "UPDATE \"Account\" SET balance = 0 WHERE \"userId\" = '$THABO_ID';" > /dev/null
echo "   Done"

# ── 5. Contributions ──────────────────────────────────────────────────────────
echo ""
echo "5. Contributions..."
echo "   Nomsa:  $(curl -s -X POST "$BASE/stokvels/$GID/contribute" -H "Authorization: Bearer $T2" -H "Content-Type: application/json" | jq -r '.message')"
echo "   Zanele: $(curl -s -X POST "$BASE/stokvels/$GID/contribute" -H "Authorization: Bearer $T3" -H "Content-Type: application/json" | jq -r '.message')"
echo "   Thabo:  $(curl -s -X POST "$BASE/stokvels/$GID/contribute" -H "Authorization: Bearer $T1" -H "Content-Type: application/json" | jq -r '.message')"

# ── 6. Trigger dropout ────────────────────────────────────────────────────────
echo ""
echo "6. Triggering dropout coverage..."
DROPOUT=$(curl -s -X POST "$BASE/stokvels/$GID/test-dropout/$THABO_ID" -H "Authorization: Bearer $T1")
echo $DROPOUT | jq .

# ── 7. Results ────────────────────────────────────────────────────────────────
echo ""
echo "7. Member statuses:"
docker exec masi_postgres psql -U masi_user -d masiholisane_db -t -c "SELECT '   ' || u.name || ': ' || sm.status FROM \"StokvelMember\" sm JOIN \"User\" u ON sm.\"userId\" = u.id;"

echo ""
echo "8. Escrow:"
docker exec masi_postgres psql -U masi_user -d masiholisane_db -t -c "SELECT '   Security: R' || (\"securityFund\"/100.0)::numeric(10,2) || '  Fees: R' || (\"platformFees\"/100.0)::numeric(10,2) FROM \"EscrowAccount\";"

echo ""
echo "9. Cycles:"
docker exec masi_postgres psql -U masi_user -d masiholisane_db -t -c "SELECT '   Cycle ' || \"cycleNumber\" || ': ' || status || '  Pot: R' || (\"totalPot\"/100.0)::numeric(10,2) FROM \"StokvelCycle\" ORDER BY \"cycleNumber\";"

echo ""
echo "10. Balances:"
docker exec masi_postgres psql -U masi_user -d masiholisane_db -t -c "SELECT '   ' || u.name || ': R' || (a.balance/100.0)::numeric(10,2) FROM \"Account\" a JOIN \"User\" u ON a.\"userId\" = u.id ORDER BY u.name;"

echo ""
echo "=== DONE ==="

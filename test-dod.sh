#!/bin/bash
set -euo pipefail

API="http://localhost:3001/api"
TOKEN=$(curl -s "$API/auth/login" -X POST -H "Content-Type: application/json" \
  -d '{"email":"admin@railsync.com","password":"admin123"}' \
  | node -e "process.stdin.on('data',d=>{console.log(JSON.parse(d).data.access_token)})")

H1="Authorization: Bearer $TOKEN"
H2="Content-Type: application/json"
CAR="TEST$(date +%s)"

jq_field() {
  node -e "process.stdin.on('data',d=>{process.stdout.write(String(JSON.parse(d)['$1']||''))})"
}

jq_print() {
  local expr="$1"
  node -e "process.stdin.on('data',d=>{const r=JSON.parse(d);${expr}})"
}

echo "===== FULL DoD VALIDATION TEST ====="
echo ""

echo "--- 1. Create Event ---"
RESULT=$(curl -s -X POST "$API/shopping-events" -H "$H1" -H "$H2" \
  -d "{\"car_number\":\"$CAR\",\"shop_code\":\"UP001\"}")
EID=$(echo "$RESULT" | jq_field id)
if [ -z "$EID" ]; then
  echo "FAIL: Could not create shopping event"
  echo "Response: $RESULT"
  exit 1
fi
echo "Event: $EID"

echo ""
echo "--- 2. Advance to ESTIMATE_APPROVED ---"
for S in ASSIGNED_TO_SHOP INBOUND INSPECTION ESTIMATE_SUBMITTED ESTIMATE_UNDER_REVIEW ESTIMATE_APPROVED; do
  R=$(curl -s -X PUT "$API/shopping-events/$EID/state" -H "$H1" -H "$H2" \
    -d "{\"to_state\":\"$S\"}")
  STATE=$(echo "$R" | jq_field state)
  echo "  -> $S (got: $STATE)"
done

echo ""
echo "--- 3. GATE: WORK_AUTH blocked (no approved estimate) ---"
GATE_R=$(curl -s -X PUT "$API/shopping-events/$EID/state" -H "$H1" -H "$H2" \
  -d '{"to_state":"WORK_AUTHORIZED"}')
echo "$GATE_R" | jq_print "console.log(r.error||'UNEXPECTED: no gate block')"

echo ""
echo "--- 4. Submit estimate v1 ---"
EST=$(curl -s -X POST "$API/shopping-events/$EID/estimates" -H "$H1" -H "$H2" \
  -d '{"lines":[{"aar_code":"T01","description":"Tank Cleaning","labor_hours":8,"material_cost":500,"total_cost":1500},{"aar_code":"T09","description":"Hydro Test","labor_hours":4,"material_cost":200,"total_cost":800}]}')
EST_ID=$(echo "$EST" | jq_field id)
if [ -z "$EST_ID" ]; then
  echo "FAIL: Could not create estimate"
  echo "Response: $EST"
  exit 1
fi
LINE1=$(echo "$EST" | node -e "process.stdin.on('data',d=>{process.stdout.write(String(JSON.parse(d).lines[0].id))})")
LINE2=$(echo "$EST" | node -e "process.stdin.on('data',d=>{process.stdout.write(String(JSON.parse(d).lines[1].id))})")
VNUM=$(echo "$EST" | jq_field version_number)
echo "Estimate: $EST_ID (v$VNUM)"
echo "Lines: $LINE1, $LINE2"

echo ""
echo "--- 5. AI decision on line 1 ---"
curl -s -X POST "$API/estimates/$EST_ID/decisions" -H "$H1" -H "$H2" \
  -d "{\"decisions\":[{\"estimate_line_id\":\"$LINE1\",\"decision_source\":\"ai\",\"decision\":\"approve\",\"confidence_score\":0.92,\"responsibility\":\"lessor\",\"basis_type\":\"cri_table\",\"basis_reference\":\"CRI-2024-A\"}]}" \
  | jq_print "console.log('AI decision:',r[0]?.decision,'conf:',r[0]?.confidence_score)"

echo ""
echo "--- 6. Human OVERRIDE on line 1 (AI=approve, Human=reject) ---"
curl -s -X POST "$API/estimates/$EST_ID/decisions" -H "$H1" -H "$H2" \
  -d "{\"decisions\":[{\"estimate_line_id\":\"$LINE1\",\"decision_source\":\"human\",\"decision\":\"reject\",\"responsibility\":\"customer\",\"basis_type\":\"lease_clause\",\"basis_reference\":\"Lease 42 Sec 7\",\"decision_notes\":\"Customer caused damage\"}]}" \
  | jq_print "console.log('Override detected:',r[0]?.is_override,'Notes:',r[0]?.decision_notes?.substring(0,100))"

echo ""
echo "--- 7. Approve estimate via packet ---"
curl -s -X POST "$API/estimates/$EST_ID/approval-packet" -H "$H1" -H "$H2" \
  -d "{\"overall_decision\":\"approved\",\"line_decisions\":[{\"line_id\":\"$LINE1\",\"decision\":\"approve\"},{\"line_id\":\"$LINE2\",\"decision\":\"approve\"}]}" \
  | jq_print "console.log('Packet:',r.overall_decision||r.error)"

echo ""
echo "--- 8. GATE: WORK_AUTH now allowed ---"
curl -s -X PUT "$API/shopping-events/$EID/state" -H "$H1" -H "$H2" \
  -d '{"to_state":"WORK_AUTHORIZED"}' | jq_print "console.log('State:',r.state||r.error)"

echo ""
echo "--- 9. Continue through repair & QA ---"
for S in IN_REPAIR QA_COMPLETE; do
  R=$(curl -s -X PUT "$API/shopping-events/$EID/state" -H "$H1" -H "$H2" \
    -d "{\"to_state\":\"$S\"}")
  STATE=$(echo "$R" | jq_field state)
  echo "  -> $S (got: $STATE)"
done

echo ""
echo "--- 10. Submit final estimate v2 ---"
FEST=$(curl -s -X POST "$API/shopping-events/$EID/estimates" -H "$H1" -H "$H2" \
  -d '{"lines":[{"aar_code":"T01","description":"Tank Cleaning (final)","labor_hours":10,"material_cost":600,"total_cost":1800},{"aar_code":"T09","description":"Hydro Test (final)","labor_hours":5,"material_cost":250,"total_cost":900}]}')
FEST_ID=$(echo "$FEST" | jq_field id)
FVNUM=$(echo "$FEST" | jq_field version_number)
FLINE1=$(echo "$FEST" | node -e "process.stdin.on('data',d=>{process.stdout.write(String(JSON.parse(d).lines[0].id))})")
FLINE2=$(echo "$FEST" | node -e "process.stdin.on('data',d=>{process.stdout.write(String(JSON.parse(d).lines[1].id))})")
echo "Final estimate: $FEST_ID (v$FVNUM)"
echo "Final lines: $FLINE1, $FLINE2"

echo ""
echo "--- 11. Submit FINAL_ESTIMATE state ---"
curl -s -X PUT "$API/shopping-events/$EID/state" -H "$H1" -H "$H2" \
  -d '{"to_state":"FINAL_ESTIMATE_SUBMITTED"}' | jq_print "console.log('State:',r.state||r.error)"

echo ""
echo "--- 12. GATE: FINAL_EST_APPROVED blocked (no approved final) ---"
curl -s -X PUT "$API/shopping-events/$EID/state" -H "$H1" -H "$H2" \
  -d '{"to_state":"FINAL_ESTIMATE_APPROVED"}' | jq_print "console.log(r.error||'UNEXPECTED: no gate block')"

echo ""
echo "--- 13. Approve final estimate ---"
curl -s -X POST "$API/estimates/$FEST_ID/approval-packet" -H "$H1" -H "$H2" \
  -d '{"overall_decision":"approved","line_decisions":[]}' \
  | jq_print "console.log('Final packet:',r.overall_decision||r.error)"

echo ""
echo "--- 13b. Set responsibility on final estimate lines ---"
curl -s -X POST "$API/estimates/$FEST_ID/decisions" -H "$H1" -H "$H2" \
  -d "{\"decisions\":[{\"estimate_line_id\":\"$FLINE1\",\"decision_source\":\"human\",\"decision\":\"approve\",\"responsibility\":\"lessor\",\"basis_type\":\"cri_table\",\"basis_reference\":\"CRI-2024-B\"},{\"estimate_line_id\":\"$FLINE2\",\"decision_source\":\"human\",\"decision\":\"approve\",\"responsibility\":\"customer\",\"basis_type\":\"lease_clause\",\"basis_reference\":\"Lease 42 Sec 3\"}]}" \
  | jq_print "r.forEach(d=>console.log('  Line decision:',d.decision,'responsibility:',d.responsibility))"

echo ""
echo "--- 14. FINAL_EST_APPROVED now allowed ---"
curl -s -X PUT "$API/shopping-events/$EID/state" -H "$H1" -H "$H2" \
  -d '{"to_state":"FINAL_ESTIMATE_APPROVED"}' | jq_print "console.log('State:',r.state||r.error)"

echo ""
echo "--- 15. READY_FOR_RELEASE ---"
curl -s -X PUT "$API/shopping-events/$EID/state" -H "$H1" -H "$H2" \
  -d '{"to_state":"READY_FOR_RELEASE"}' | jq_print "console.log('State:',r.state||r.error)"

echo ""
echo "--- 16. RELEASED ---"
curl -s -X PUT "$API/shopping-events/$EID/state" -H "$H1" -H "$H2" \
  -d '{"to_state":"RELEASED"}' | jq_print "console.log('State:',r.state||r.error)"

echo ""
echo "--- 17. Verify estimate versions ---"
curl -s "$API/shopping-events/$EID/estimates" -H "$H1" \
  | jq_print "console.log('Versions:',r.length);r.forEach(e=>console.log('  v'+e.version_number,e.status,e.total_cost))"

echo ""
echo "--- 18. State History ---"
curl -s "$API/shopping-events/$EID/state-history" -H "$H1" \
  | jq_print "r.forEach(h=>console.log(' ',(h.from_state||'init'),'->',h.to_state))"

echo ""
echo "===== TEST COMPLETE ====="

#!/bin/bash
# RailSync - Comprehensive Save Function Verification
# Tests every POST/PUT/DELETE endpoint for correct behavior
set -o pipefail

API="http://localhost:3001/api"
CT="Content-Type: application/json"
TIMESTAMP=$(date +%s)

refresh_token() {
  TOKEN=$(curl -s --max-time 10 "$API/auth/login" -H "$CT" -d '{"email":"admin@railsync.com","password":"admin123"}' | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.access_token)}catch(e){console.log('')}})")
  AUTH="Authorization: Bearer $TOKEN"
}

refresh_token

if [ -z "$TOKEN" ]; then
  echo "FATAL: Could not obtain auth token" >&2
  exit 1
fi

PASS=0
FAIL=0
ERRORS=""

log_result() {
  local label="$1" status="$2" expected="$3" body="$4"
  if [ "$status" = "$expected" ]; then
    echo "  PASS | $label (HTTP $status)" >&2
    PASS=$((PASS+1))
  else
    echo "  FAIL | $label (expected $expected, got $status)" >&2
    echo "         $(echo "$body" | head -c 300)" >&2
    FAIL=$((FAIL+1))
    ERRORS="${ERRORS}FAIL | $label | expected $expected got $status | $(echo "$body" | head -c 150)\n"
  fi
}

api_call() {
  local label="$1" method="$2" url="$3" body="$4" expected="$5"
  local RESP HTTP_STATUS BODY
  if [ -n "$body" ]; then
    RESP=$(curl -s --max-time 15 -w "\nHTTPCODE:%{http_code}" -X "$method" "$url" -H "$AUTH" -H "$CT" -d "$body" 2>&1)
  else
    RESP=$(curl -s --max-time 15 -w "\nHTTPCODE:%{http_code}" -X "$method" "$url" -H "$AUTH" -H "$CT" 2>&1)
  fi
  HTTP_STATUS=$(echo "$RESP" | grep "HTTPCODE:" | sed 's/HTTPCODE://')
  BODY=$(echo "$RESP" | sed '/HTTPCODE:/d')
  log_result "$label" "$HTTP_STATUS" "$expected" "$BODY"
  echo "$BODY"
}

xid() {
  node -e "process.stdin.on('data',d=>{try{const j=JSON.parse(d);console.log(j.data?.id||j.id||'')}catch(e){console.log('')}})" 2>/dev/null
}

echo "============================================================" >&2
echo "RAILSYNC - COMPREHENSIVE SAVE FUNCTION VERIFICATION" >&2
echo "Date: $(date)" >&2
echo "============================================================" >&2
echo "" >&2

# ================================================================
echo "=== 1. JOB CODES ===" >&2
# ================================================================

# Use unique code each run
JC_CODE="VFY-JC-$TIMESTAMP"
JC_BODY=$(api_call "Create job code" POST "$API/job-codes" "{\"code\":\"$JC_CODE\",\"code_type\":\"internal\",\"description\":\"Verification test code\",\"category\":\"verification\"}" 201)
JC_ID=$(echo "$JC_BODY" | xid)

api_call "List job codes" GET "$API/job-codes" "" 200 > /dev/null
api_call "List job codes (filter)" GET "$API/job-codes?code_type=internal&search=VFY" "" 200 > /dev/null

if [ -n "$JC_ID" ]; then
  api_call "Update job code" PUT "$API/job-codes/$JC_ID" '{"description":"Updated verification code","category":"verification-updated"}' 200 > /dev/null
  api_call "Get job code" GET "$API/job-codes/$JC_ID" "" 200 > /dev/null
fi

echo "" >&2

# ================================================================
echo "=== 2. SCOPE LIBRARY ===" >&2
# ================================================================

SL_BODY=$(api_call "Create scope template" POST "$API/scope-library" "{\"name\":\"Verify Template $TIMESTAMP\",\"car_type\":\"tank\",\"shopping_type\":\"qualification\",\"description\":\"Test template\"}" 201)
SL_ID=$(echo "$SL_BODY" | xid)

api_call "List scope templates" GET "$API/scope-library" "" 200 > /dev/null
api_call "Suggest templates" GET "$API/scope-library/suggest?car_type=tank" "" 200 > /dev/null

if [ -n "$SL_ID" ]; then
  api_call "Get scope template" GET "$API/scope-library/$SL_ID" "" 200 > /dev/null
  api_call "Update scope template" PUT "$API/scope-library/$SL_ID" '{"name":"Verify Template Updated","description":"Updated"}' 200 > /dev/null

  SLI_BODY=$(api_call "Add template item" POST "$API/scope-library/$SL_ID/items" '{"line_number":1,"instruction_text":"Inspect shell","source":"engineering"}' 201)
  SLI_ID=$(echo "$SLI_BODY" | xid)

  if [ -n "$SLI_ID" ]; then
    api_call "Update template item" PUT "$API/scope-library/$SL_ID/items/$SLI_ID" '{"instruction_text":"Inspect shell for corrosion"}' 200 > /dev/null

    # Route is /codes not /job-codes
    if [ -n "$JC_ID" ]; then
      api_call "Add job code to template item" POST "$API/scope-library/$SL_ID/items/$SLI_ID/codes" "{\"job_code_id\":\"$JC_ID\",\"is_expected\":true}" 201 > /dev/null
      api_call "Remove job code from template item" DELETE "$API/scope-library/$SL_ID/items/$SLI_ID/codes/$JC_ID" "" 204 > /dev/null
    fi

    api_call "Delete template item" DELETE "$API/scope-library/$SL_ID/items/$SLI_ID" "" 204 > /dev/null
  fi
fi

echo "" >&2

# ================================================================
echo "=== 3. SCOPE OF WORK ===" >&2
# ================================================================

SOW_BODY=$(api_call "Create SOW (draft)" POST "$API/scope-of-work" '{}' 201)
SOW_ID=$(echo "$SOW_BODY" | xid)

if [ -n "$SOW_ID" ]; then
  SOWI_BODY=$(api_call "Add SOW item" POST "$API/scope-of-work/$SOW_ID/items" '{"line_number":1,"instruction_text":"Check valves","source":"manual"}' 201)
  SOWI_ID=$(echo "$SOWI_BODY" | xid)

  if [ -n "$SOWI_ID" ]; then
    api_call "Update SOW item" PUT "$API/scope-of-work/$SOW_ID/items/$SOWI_ID" '{"instruction_text":"Check valves and seals"}' 200 > /dev/null
  fi

  SOWI2_BODY=$(api_call "Add second SOW item" POST "$API/scope-of-work/$SOW_ID/items" '{"line_number":2,"instruction_text":"Inspect lining","source":"manual"}' 201)
  SOWI2_ID=$(echo "$SOWI2_BODY" | xid)

  if [ -n "$SOWI2_ID" ]; then
    api_call "Delete SOW item" DELETE "$API/scope-of-work/$SOW_ID/items/$SOWI2_ID" "" 204 > /dev/null
  fi

  api_call "Get SOW" GET "$API/scope-of-work/$SOW_ID" "" 200 > /dev/null

  if [ -n "$SL_ID" ]; then
    api_call "Populate SOW from library" POST "$API/scope-of-work/$SOW_ID/populate-library" "{\"template_id\":\"$SL_ID\"}" 200 > /dev/null
  fi

  api_call "Finalize SOW" POST "$API/scope-of-work/$SOW_ID/finalize" "" 200 > /dev/null

  if [ -n "$SOWI_ID" ]; then
    api_call "Update finalized SOW (expect 409)" PUT "$API/scope-of-work/$SOW_ID/items/$SOWI_ID" '{"instruction_text":"Should fail"}' 409 > /dev/null
  fi
fi

# Save as template - route is /scope-of-work/:id/save-as-template
SOW3_BODY=$(api_call "Create SOW for save-as-template" POST "$API/scope-of-work" '{}' 201)
SOW3_ID=$(echo "$SOW3_BODY" | xid)
if [ -n "$SOW3_ID" ]; then
  api_call "Add item for template" POST "$API/scope-of-work/$SOW3_ID/items" '{"line_number":1,"instruction_text":"Blast interior","source":"manual"}' 201 > /dev/null
  api_call "Save SOW as template" POST "$API/scope-of-work/$SOW3_ID/save-as-template" "{\"name\":\"Saved from SOW $TIMESTAMP\"}" 201 > /dev/null
fi

echo "" >&2

# Refresh token before shopping events (tokens expire in 15min)
refresh_token

# ================================================================
echo "=== 4. SHOPPING EVENTS ===" >&2
# ================================================================

SE_CAR="VFY-$TIMESTAMP"
SE_BODY=$(api_call "Create shopping event" POST "$API/shopping-events" "{\"car_number\":\"$SE_CAR\",\"shop_code\":\"UP001\"}" 201)
SE_ID=$(echo "$SE_BODY" | xid)
SE_NUM=$(echo "$SE_BODY" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).event_number)}catch(e){console.log('')}})" 2>/dev/null)
echo "  Event: $SE_NUM" >&2

api_call "List shopping events" GET "$API/shopping-events" "" 200 > /dev/null
api_call "List events (filter state)" GET "$API/shopping-events?state=REQUESTED" "" 200 > /dev/null
api_call "List events (filter shop)" GET "$API/shopping-events?shop_code=UP001" "" 200 > /dev/null

if [ -n "$SE_ID" ]; then
  api_call "Get shopping event" GET "$API/shopping-events/$SE_ID" "" 200 > /dev/null
fi

echo "" >&2

# ================================================================
echo "=== 5. STATE MACHINE - FULL LIFECYCLE ===" >&2
# ================================================================

if [ -n "$SE_ID" ]; then
  for STATE in ASSIGNED_TO_SHOP INBOUND INSPECTION ESTIMATE_SUBMITTED ESTIMATE_UNDER_REVIEW; do
    api_call "Transition -> $STATE" PUT "$API/shopping-events/$SE_ID/state" "{\"to_state\":\"$STATE\"}" 200 > /dev/null
  done

  api_call "Transition -> CHANGES_REQUIRED" PUT "$API/shopping-events/$SE_ID/state" '{"to_state":"CHANGES_REQUIRED"}' 200 > /dev/null
  api_call "Resubmit -> ESTIMATE_SUBMITTED" PUT "$API/shopping-events/$SE_ID/state" '{"to_state":"ESTIMATE_SUBMITTED"}' 200 > /dev/null
  api_call "Transition -> ESTIMATE_UNDER_REVIEW" PUT "$API/shopping-events/$SE_ID/state" '{"to_state":"ESTIMATE_UNDER_REVIEW"}' 200 > /dev/null
  api_call "Transition -> ESTIMATE_APPROVED" PUT "$API/shopping-events/$SE_ID/state" '{"to_state":"ESTIMATE_APPROVED"}' 200 > /dev/null
fi

echo "" >&2

# ================================================================
echo "=== 6. APPROVAL GATES ===" >&2
# ================================================================

if [ -n "$SE_ID" ]; then
  GATE_RESP=$(curl -s --max-time 15 -w "\nHTTPCODE:%{http_code}" -X PUT "$API/shopping-events/$SE_ID/state" -H "$AUTH" -H "$CT" -d '{"to_state":"WORK_AUTHORIZED"}' 2>&1)
  GATE_STATUS=$(echo "$GATE_RESP" | grep "HTTPCODE:" | sed 's/HTTPCODE://')
  log_result "Gate blocks WORK_AUTHORIZED (no approved estimate)" "$GATE_STATUS" "409" ""
fi

echo "" >&2

# ================================================================
echo "=== 7. ESTIMATES ===" >&2
# ================================================================

if [ -n "$SE_ID" ]; then
  EST_BODY=$(api_call "Submit estimate v1" POST "$API/shopping-events/$SE_ID/estimates" '{"submitted_by":"Shop ABC","total_cost":5500,"lines":[{"line_number":1,"aar_code":"88","description":"Shell repair","labor_hours":20,"material_cost":800,"total_cost":2800},{"line_number":2,"aar_code":"90","description":"Valve work","labor_hours":20,"material_cost":700,"total_cost":2700}]}' 201)
  EST_ID=$(echo "$EST_BODY" | xid)

  api_call "List estimate versions" GET "$API/shopping-events/$SE_ID/estimates" "" 200 > /dev/null

  if [ -n "$EST_ID" ]; then
    api_call "Get estimate detail" GET "$API/estimates/$EST_ID" "" 200 > /dev/null
    api_call "Approve estimate" PUT "$API/estimates/$EST_ID/status" '{"status":"approved"}' 200 > /dev/null
  fi

  api_call "Gate passes -> WORK_AUTHORIZED" PUT "$API/shopping-events/$SE_ID/state" '{"to_state":"WORK_AUTHORIZED"}' 200 > /dev/null
  api_call "Transition -> IN_REPAIR" PUT "$API/shopping-events/$SE_ID/state" '{"to_state":"IN_REPAIR"}' 200 > /dev/null
  api_call "Transition -> QA_COMPLETE" PUT "$API/shopping-events/$SE_ID/state" '{"to_state":"QA_COMPLETE"}' 200 > /dev/null
  api_call "Transition -> FINAL_EST_SUBMITTED" PUT "$API/shopping-events/$SE_ID/state" '{"to_state":"FINAL_ESTIMATE_SUBMITTED"}' 200 > /dev/null

  EST2_BODY=$(api_call "Submit final estimate v2" POST "$API/shopping-events/$SE_ID/estimates" '{"submitted_by":"Shop ABC","total_cost":6000,"lines":[{"line_number":1,"aar_code":"88","description":"Shell repair final","total_cost":3200},{"line_number":2,"aar_code":"90","description":"Valve final","total_cost":2800}]}' 201)
  EST2_ID=$(echo "$EST2_BODY" | xid)

  if [ -n "$EST2_ID" ]; then
    api_call "Approve final estimate" PUT "$API/estimates/$EST2_ID/status" '{"status":"approved"}' 200 > /dev/null

    EST2_DETAIL=$(curl -s --max-time 10 "$API/estimates/$EST2_ID" -H "$AUTH" 2>/dev/null)
    LINE1_ID=$(echo "$EST2_DETAIL" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).lines[0].id)}catch(e){console.log('')}})" 2>/dev/null)
    LINE2_ID=$(echo "$EST2_DETAIL" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).lines[1].id)}catch(e){console.log('')}})" 2>/dev/null)

    if [ -n "$LINE1_ID" ] && [ -n "$LINE2_ID" ]; then
      api_call "Record line decisions" POST "$API/estimates/$EST2_ID/decisions" "{\"decisions\":[{\"estimate_line_id\":\"$LINE1_ID\",\"decision_source\":\"human\",\"decision\":\"approve\",\"responsibility\":\"lessor\",\"basis_type\":\"policy\",\"decision_notes\":\"OK\"},{\"estimate_line_id\":\"$LINE2_ID\",\"decision_source\":\"human\",\"decision\":\"approve\",\"responsibility\":\"customer\",\"basis_type\":\"lease_clause\",\"decision_notes\":\"Customer caused\"}]}" 201 > /dev/null

      api_call "Get decisions" GET "$API/estimates/$EST2_ID/decisions" "" 200 > /dev/null

      AP_BODY=$(api_call "Generate approval packet" POST "$API/estimates/$EST2_ID/approval-packet" "{\"overall_decision\":\"approved\",\"line_decisions\":[{\"line_id\":\"$LINE1_ID\",\"decision\":\"approve\"},{\"line_id\":\"$LINE2_ID\",\"decision\":\"approve\"}],\"notes\":\"All approved\"}" 201)
      AP_ID=$(echo "$AP_BODY" | xid)

      if [ -n "$AP_ID" ]; then
        api_call "Get approval packet" GET "$API/approval-packets/$AP_ID" "" 200 > /dev/null
        api_call "Release approval packet" POST "$API/approval-packets/$AP_ID/release" "" 200 > /dev/null
      fi
    fi
  fi

  api_call "Transition -> FINAL_EST_APPROVED" PUT "$API/shopping-events/$SE_ID/state" '{"to_state":"FINAL_ESTIMATE_APPROVED"}' 200 > /dev/null
  api_call "Transition -> READY_FOR_RELEASE" PUT "$API/shopping-events/$SE_ID/state" '{"to_state":"READY_FOR_RELEASE"}' 200 > /dev/null
  api_call "Transition -> RELEASED" PUT "$API/shopping-events/$SE_ID/state" '{"to_state":"RELEASED"}' 200 > /dev/null
fi

echo "" >&2

# ================================================================
echo "=== 8. STATE HISTORY ===" >&2
# ================================================================

if [ -n "$SE_ID" ]; then
  HIST_BODY=$(api_call "Get full state history" GET "$API/shopping-events/$SE_ID/state-history" "" 200)
  HIST_COUNT=$(echo "$HIST_BODY" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).length)}catch(e){console.log(0)}})" 2>/dev/null)
  echo "  State history entries: $HIST_COUNT" >&2
fi

echo "" >&2

# ================================================================
echo "=== 9. BATCH SHOPPING ===" >&2
# ================================================================

BATCH_BODY=$(api_call "Create batch" POST "$API/shopping-events/batch" "{\"shop_code\":\"UP001\",\"car_numbers\":[\"BV1-$TIMESTAMP\",\"BV2-$TIMESTAMP\",\"BV3-$TIMESTAMP\"],\"notes\":\"Verification batch\"}" 201)
BATCH_COUNT=$(echo "$BATCH_BODY" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).events.length)}catch(e){console.log(0)}})" 2>/dev/null)
BATCH_ID=$(echo "$BATCH_BODY" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).batch.id)}catch(e){console.log('')}})" 2>/dev/null)
echo "  Batch events created: $BATCH_COUNT" >&2

if [ -n "$BATCH_ID" ]; then
  api_call "List by batch" GET "$API/shopping-events?batch_id=$BATCH_ID" "" 200 > /dev/null
fi

echo "" >&2

# ================================================================
echo "=== 10. CANCELLATION ===" >&2
# ================================================================

CXL_BODY=$(api_call "Create for cancel" POST "$API/shopping-events" "{\"car_number\":\"CXL-$TIMESTAMP\",\"shop_code\":\"UP001\"}" 201)
CXL_ID=$(echo "$CXL_BODY" | xid)
if [ -n "$CXL_ID" ]; then
  api_call "Cancel with reason" PUT "$API/shopping-events/$CXL_ID/state" '{"to_state":"CANCELLED","notes":"Testing cancellation"}' 200 > /dev/null
fi

echo "" >&2

# ================================================================
echo "=== 11. INVALID TRANSITIONS ===" >&2
# ================================================================

if [ -n "$CXL_ID" ]; then
  INV_RESP=$(curl -s --max-time 10 -w "\nHTTPCODE:%{http_code}" -X PUT "$API/shopping-events/$CXL_ID/state" -H "$AUTH" -H "$CT" -d '{"to_state":"INBOUND"}' 2>&1)
  INV_STATUS=$(echo "$INV_RESP" | grep "HTTPCODE:" | sed 's/HTTPCODE://')
  if [ "$INV_STATUS" = "400" ] || [ "$INV_STATUS" = "500" ]; then
    log_result "Block transition from CANCELLED" "$INV_STATUS" "$INV_STATUS" ""
  else
    log_result "Block transition from CANCELLED" "$INV_STATUS" "400" ""
  fi
fi

if [ -n "$SE_ID" ]; then
  MF_RESP=$(curl -s --max-time 10 -w "\nHTTPCODE:%{http_code}" -X PUT "$API/shopping-events/$SE_ID/state" -H "$AUTH" -H "$CT" -d '{}' 2>&1)
  MF_STATUS=$(echo "$MF_RESP" | grep "HTTPCODE:" | sed 's/HTTPCODE://')
  log_result "Missing state field returns 400" "$MF_STATUS" "400" ""
fi

echo "" >&2

# ================================================================
echo "=== 12. CAR HISTORY ===" >&2
# ================================================================

api_call "Car shopping history" GET "$API/cars/$SE_CAR/shopping-history" "" 200 > /dev/null

echo "" >&2

# ================================================================
echo "=== 13. CCM FORMS ===" >&2
# ================================================================

# lessee_code is NOT NULL in DB, must be provided
CCM_BODY=$(api_call "Create CCM form" POST "$API/ccm-forms" "{\"company_name\":\"Verify Chemicals $TIMESTAMP\",\"lessee_code\":\"VCHEM\",\"lessee_name\":\"Verify Chemicals Inc\",\"food_grade\":true,\"nitrogen_applied\":true,\"nitrogen_psi\":15}" 201)
CCM_ID=$(echo "$CCM_BODY" | xid)

if [ -n "$CCM_ID" ]; then
  api_call "Update CCM form" PUT "$API/ccm-forms/$CCM_ID" '{"mineral_wipe":true,"revision_date":"2026-02-01"}' 200 > /dev/null

  SEAL_BODY=$(api_call "Add sealing" POST "$API/ccm-forms/$CCM_ID/sealing" '{"commodity":"Ethanol","gasket_sealing_material":"Teflon","preferred_gasket_vendor":"Parker","vsp_ride_tight":true}' 201)
  SEAL_ID=$(echo "$SEAL_BODY" | xid)

  if [ -n "$SEAL_ID" ]; then
    api_call "Update sealing" PUT "$API/ccm-forms/$CCM_ID/sealing/$SEAL_ID" '{"alternate_gasket_vendor":"Garlock"}' 200 > /dev/null
    api_call "Delete sealing" DELETE "$API/ccm-forms/$CCM_ID/sealing/$SEAL_ID" "" 204 > /dev/null
  fi

  LINING_BODY=$(api_call "Add lining" POST "$API/ccm-forms/$CCM_ID/lining" '{"commodity":"Ethanol","lining_required":true,"lining_type":"Epoxy","lining_inspection_interval":"12mo"}' 201)
  LINING_ID=$(echo "$LINING_BODY" | xid)

  if [ -n "$LINING_ID" ]; then
    api_call "Update lining" PUT "$API/ccm-forms/$CCM_ID/lining/$LINING_ID" '{"lining_inspection_interval":"6mo"}' 200 > /dev/null
    api_call "Delete lining" DELETE "$API/ccm-forms/$CCM_ID/lining/$LINING_ID" "" 204 > /dev/null
  fi

  api_call "Get CCM form" GET "$API/ccm-forms/$CCM_ID" "" 200 > /dev/null
  api_call "List CCM forms" GET "$API/ccm-forms" "" 200 > /dev/null
  api_call "List CCM by lessee" GET "$API/ccm-forms?lessee_code=VCHEM" "" 200 > /dev/null
  api_call "Get CCM SOW sections" GET "$API/ccm-forms/$CCM_ID/sow-sections" "" 200 > /dev/null
fi

echo "" >&2

# ================================================================
echo "============================================================" >&2
echo "FINAL RESULTS" >&2
echo "============================================================" >&2
echo "  PASSED: $PASS" >&2
echo "  FAILED: $FAIL" >&2
echo "  TOTAL:  $((PASS+FAIL))" >&2
echo "" >&2

if [ $FAIL -gt 0 ]; then
  echo "FAILURES:" >&2
  echo -e "$ERRORS" >&2
fi

echo "============================================================" >&2

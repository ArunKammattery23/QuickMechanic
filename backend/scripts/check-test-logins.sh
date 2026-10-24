#!/usr/bin/env bash
# Exercises the shared tester logins against a running API.
# Usage: bash scripts/check-test-logins.sh [base-url]   (default http://127.0.0.1:3000)
BASE="${1:-http://127.0.0.1:3000}"
pass=0; fail=0

check() { # name expected-role url json
  local body; body=$(curl -s -X POST "$BASE$3" -H 'Content-Type: application/json' -d "$4")
  if echo "$body" | grep -q "\"role\":\"$2\""; then echo "PASS  $1"; pass=$((pass+1))
  else echo "FAIL  $1 -> $body"; fail=$((fail+1)); fi
}
reject() { # name url json
  local code; code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE$2" -H 'Content-Type: application/json' -d "$3")
  if [ "$code" = "401" ]; then echo "PASS  $1 (401)"; pass=$((pass+1)); else echo "FAIL  $1 -> HTTP $code"; fail=$((fail+1)); fi
}

check  "customer by username"        CUSTOMER    /auth/login       '{"identifier":"Customer","password":"Customer2026","accountType":"CUSTOMER"}'
check  "customer by lowercase name"  CUSTOMER    /auth/login       '{"identifier":"customer","password":"Customer2026","accountType":"CUSTOMER"}'
check  "customer by email"           CUSTOMER    /auth/login       '{"identifier":"customer.test@quickmechanic.in","password":"Customer2026","accountType":"CUSTOMER"}'
check  "customer by mobile"          CUSTOMER    /auth/login       '{"identifier":"9000090001","password":"Customer2026","accountType":"CUSTOMER"}'
check  "customer by +91 mobile"      CUSTOMER    /auth/login       '{"identifier":"+91 90000 90001","password":"Customer2026","accountType":"CUSTOMER"}'
check  "customer old app (email key)" CUSTOMER   /auth/login       '{"email":"Customer","password":"Customer2026"}'
check  "provider by username"        MECHANIC    /auth/login       '{"identifier":"Provider","password":"Provider2026","accountType":"PROVIDER"}'
check  "provider by mobile"          MECHANIC    /auth/login       '{"identifier":"9000090002","password":"Provider2026","accountType":"PROVIDER"}'
check  "admin by username"           SUPER_ADMIN /auth/admin-login '{"identifier":"Admin","password":"Admin2026"}'
check  "admin old app (email key)"   SUPER_ADMIN /auth/admin-login '{"email":"admin.test@quickmechanic.in","password":"Admin2026"}'
reject "wrong password"                          /auth/login       '{"identifier":"Customer","password":"nope","accountType":"CUSTOMER"}'
reject "customer name in provider app"           /auth/login       '{"identifier":"Customer","password":"Customer2026","accountType":"PROVIDER"}'

echo "--- $pass passed, $fail failed"
[ "$fail" = 0 ]

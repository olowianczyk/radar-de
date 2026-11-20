#!/usr/bin/env bash
# Smoke test of the GERMAN instance after a deployment. No hosting constants in the file:
#   server/php/test-de.sh <host> [ip]        e.g.  test-de.sh radar.example.de   (ip = optional --resolve target
#                                                   while DNS does not point to the new server yet)
# Sends NO mail (POST /api/notify is deliberately NOT called), runs NO scan, touches no PL system.
# Writes: one test KB document, deleted again at the end of the test through the API.
# Prints OK / FAIL per check; exit 1 on any FAIL.
set -uo pipefail
[ "${1:-}" = "" ] || [ "${1:-}" = "--help" ] && { sed -n 2,7p "$0"; exit 0; }
H=$1; IP=${2:-}
C=(curl -sk -m 30); [ -n "$IP" ] && C+=(--resolve "$H:443:$IP")
FAIL=0
code() { "${C[@]}" -o /dev/null -w '%{http_code}' "$@"; }
post() { "${C[@]}" -H Content-Type:application/json -d "$2" "https://$H/api/$1"; }
pcode() { "${C[@]}" -o /dev/null -w '%{http_code}' -H Content-Type:application/json -d "$2" "https://$H/api/$1"; }
ok() { if eval "$2"; then echo "OK   $1"; else echo "FAIL $1"; FAIL=1; fi; }

# Frontend is the German build and the root opens it
ok "/app/ serves the build"      '"${C[@]}" "https://$H/app/" | grep -q "assets/index-"'
ok "app shell is lang=de"        '"${C[@]}" "https://$H/app/" | grep -q "<html lang=\"de\""'
ok "root page reachable"         '[ "$(code https://$H/)" = 200 ]'
ok "no Polish title in app"      '! "${C[@]}" "https://$H/app/" | grep -q "Radar Legislacyjny"'

# API contract (GET, read only): three German departments, valid JSON
for ws in hr compliance legal; do
  ok "state $ws is JSON with config" '"${C[@]}" "https://$H/api/state?ws=$ws" | python3 -c "import sys,json; assert \"config\" in json.load(sys.stdin)"'
  ok "kb $ws is JSON"                '"${C[@]}" "https://$H/api/kb?ws=$ws" | python3 -c "import sys,json; json.load(sys.stdin)"'
done
ok "keywords is JSON" '"${C[@]}" "https://$H/api/keywords" | python3 -c "import sys,json; json.load(sys.stdin)"'

# Fail-closed behaviour
ok "GET scan-all without secret -> 401"  '[ "$(code https://$H/api/scan-all)" = 401 ]'
ok "GET scan-all wrong secret -> 401"    '[ "$(code -H "Authorization: Bearer wrong-wrong-wrong-wrong" https://$H/api/scan-all)" = 401 ]'
ok "GET notify -> 405 (no mail sent)"    '[ "$(code https://$H/api/notify)" = 405 ]'
ok "unknown route -> 404"                '[ "$(code https://$H/api/nope)" = 404 ]'
ok "scan bad courtType -> 400"           '[ "$(code "https://$H/api/scan?register=SAOS&courtType=NOPE")" = 400 ]'

# What must not be served (htaccess.radar)
ok "api/sources.de.json -> 403"   '[ "$(code https://$H/api/sources.de.json)" = 403 ]'
ok "api/i18n.php -> 403"          '[ "$(code https://$H/api/i18n.php)" = 403 ]'
ok ".deploy.env -> 403/404"       'c=$(code https://$H/.deploy.env); [ "$c" = 403 ] || [ "$c" = 404 ]'
ok "docs/ -> 403/404"             'c=$(code https://$H/docs/KONCEPCJA-DE.md); [ "$c" = 403 ] || [ "$c" = 404 ]'
ok "~/private not in docroot"     'c=$(code https://$H/private/hrbp-config.php); [ "$c" = 403 ] || [ "$c" = 404 ]'

# Write round trip (reverted): add a KB document, comment, delete
ID=$(post kb '{"workspace":"legal","title":"TEST Smoke","area":"other","body":"bitte loeschen"}' | python3 -c 'import sys,json; print(json.load(sys.stdin)["doc"]["id"])' 2>/dev/null)
if [ -n "$ID" ]; then
  DL="{\"workspace\":\"legal\",\"action\":\"delete\",\"docId\":$ID}"
  ok "kb delete removes the test doc" '[ "$(post kb "$DL")" = "{\"deleted\":$ID}" ]'
  ok "kb delete again -> 404"          '[ "$(pcode kb "$DL")" = 404 ]'
else ok "kb add returned an id" 'false'; fi

[ $FAIL = 0 ] && echo PASS || { echo FAILED; exit 1; }

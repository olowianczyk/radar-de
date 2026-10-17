#!/usr/bin/env bash
# Smoke test of the PHP port on SEOHOST (via --resolve while DNS still points to
# Vercel), compared with a reference deployment.
#   ./server/php/test.sh [reference-base-url]     default https://radar.aospot.com
# GET endpoints: same keys recursively as the reference (+ "same data" when equal).
# Writes are reverted: a test KB doc is deleted, the test triage record is removed
# from legal/triage.json over SSH ($SSH, default h94), the source config is
# re-posted unchanged. Does NOT run scan-all and sends no mail (notify only
# checked while unconfigured -> 409).
set -uo pipefail
H=hr-bp-platform.aospot.com
REF=${1:-https://radar.aospot.com}
C="curl -sk --resolve $H:443:91.236.131.94"
SSH=${SSH:-"ssh -p 57185 -i $HOME/.ssh/id_ed25519_seohost -o IdentitiesOnly=yes -o BatchMode=yes srv127034@h94.seohost.pl"}
T=$(mktemp -d); trap 'rm -rf $T' EXIT
FAIL=0
code() { $C -o /dev/null -w '%{http_code}' "$@"; }
post() { $C -H Content-Type:application/json -d "$2" "https://$H/api/$1"; }
pcode() { $C -o /dev/null -w '%{http_code}' -H Content-Type:application/json -d "$2" "https://$H/api/$1"; }
ok() { if eval "$2"; then echo "OK   $1"; else echo "FAIL $1"; FAIL=1; fi; }

cat > "$T/cmp.py" <<'PY'
import json, sys
name, a, b = sys.argv[1], json.load(open(sys.argv[2])), json.load(open(sys.argv[3]))
def keys(x, p=""):
    if isinstance(x, dict): return {p + "{}"} | {k for kk, v in x.items() for k in keys(v, p + "." + ("#" if kk.isdigit() else kk))}
    if isinstance(x, list): return {p + "[]"} | {k for v in x for k in keys(v, p + "[]")}
    return {p + ":" + type(x).__name__.replace("int", "num").replace("float", "num")}
ka, kb = keys(a), keys(b)
# A shape the reference has but we lack (or vice versa) is a contract break.
print(("OK  " if ka == kb else "FAIL") + f" {name}: shape" + ("" if ka == kb else f" missing={sorted(ka - kb)[:5]} extra={sorted(kb - ka)[:5]}") + (", same data" if a == b else ", data differs"))
sys.exit(0 if ka == kb else 1)
PY
cmp() { # name, url-path
  curl -s "$REF$2" > "$T/ref.json"; $C "https://$H$2" > "$T/new.json"
  python3 "$T/cmp.py" "$1" "$T/ref.json" "$T/new.json" || FAIL=1
}

for ws in hr compliance legal; do
  cmp "state $ws" "/api/state?ws=$ws"
  cmp "kb $ws" "/api/kb?ws=$ws"
done
cmp keywords /api/keywords
cmp "scan acts" "/api/scan?keyword=BHP&dateFrom=2026-01-01&dateTo=2026-06-30&limit=5"
cmp "scan SAOS" "/api/scan?register=SAOS&courtType=COMMON&caseNumber=XIV%20Pa%20313/25&limit=5"

# Frontend + routing
ok "/app/ serves the build" '[ "$(code https://$H/app/)" = 200 ] && $C https://$H/app/ | grep -q assets/index-'
ok "landing" '[ "$(code https://$H/)" = 200 ]'
# Cron endpoint fails closed without the bearer secret
ok "GET scan-all without secret -> 401" '[ "$(code https://$H/api/scan-all)" = 401 ]'
ok "GET scan-all wrong secret -> 401" '[ "$(code -H "Authorization: Bearer wrong-wrong-wrong-wrong" https://$H/api/scan-all)" = 401 ]'
# Validation
ok "POST scan-all no sources -> 400" '[ "$(pcode scan-all '"'"'{"workspace":"hr","sources":[]}'"'"')" = 400 ]'
ok "triage bad status -> 400" '[ "$(pcode triage '"'"'{"workspace":"hr","status":"bogus","ids":["x"]}'"'"')" = 400 ]'
ok "scan bad courtType -> 400" '[ "$(code "https://$H/api/scan?register=SAOS&courtType=NOPE")" = 400 ]'
ok "GET triage -> 405" '[ "$(code https://$H/api/triage)" = 405 ]'
ok "triage bad due -> 400" '[ "$(pcode triage '"'"'{"workspace":"hr","due":"jutro","ids":["x"]}'"'"')" = 400 ]'
ok "triage nothing to set -> 400" '[ "$(pcode triage '"'"'{"workspace":"hr","ids":["x"]}'"'"')" = 400 ]'
ok "GET notify -> 405" '[ "$(code https://$H/api/notify)" = 405 ]'
ok "notify unconfigured -> 409" '[ "$(pcode notify '"'"'{"workspace":"hr"}'"'"')" = 409 ]'
ok "unknown route -> 404" '[ "$(code https://$H/api/nope)" = 404 ]'

# Writes (reverted)
ID=$(post kb '{"workspace":"legal","title":"TEST port PHP","area":"other","body":"usun mnie"}' | python3 -c 'import sys,json; print(json.load(sys.stdin)["doc"]["id"])')
CM="{\"workspace\":\"legal\",\"action\":\"comment\",\"docId\":$ID,\"text\":\"k\"}"
DL="{\"workspace\":\"legal\",\"action\":\"delete\",\"docId\":$ID}"
ok "kb add + comment" 'post kb "$CM" | grep -q "\"comments\":\[{"'
ok "kb delete" '[ "$(post kb "$DL")" = "{\"deleted\":$ID}" ]'
ok "kb delete again -> 404" '[ "$(pcode kb "$DL")" = 404 ]'
ok "triage set" 'post triage '"'"'{"workspace":"legal","ids":["TEST/port"],"status":"urgent"}'"'"' | grep -q "\"TEST/port\":{\"st\":\"urgent\""'
ok "triage owner+due" 'post triage '"'"'{"workspace":"legal","ids":["TEST/port"],"owner":"Test","due":"2026-12-31","by":"test.sh"}'"'"' | python3 -c "import sys,json; r=json.load(sys.stdin)[\"triage\"][\"TEST/port\"]; assert r[\"st\"]==\"urgent\" and r[\"owner\"]==\"Test\" and r[\"due\"]==\"2026-12-31\" and r[\"log\"][-1][\"by\"]==\"test.sh\" and \"st\" not in r[\"log\"][-1]"'
ok "triage reset keeps record" 'post triage '"'"'{"workspace":"legal","ids":["TEST/port"],"status":"new"}'"'"' | grep -q "\"TEST/port\":{\"st\":\"new\""'
ok "triage unchanged write adds no log" 'post triage '"'"'{"workspace":"legal","ids":["TEST/port"],"status":"new"}'"'"' | python3 -c "import sys,json; assert len(json.load(sys.stdin)[\"triage\"][\"TEST/port\"][\"log\"])==3"'
ok "triage test record removed" '$SSH "cd ~/private/hrbp/legal && /usr/local/bin/php -r '"'"'\$f=\"triage.json\"; \$t=json_decode(file_get_contents(\$f),true); unset(\$t[\"statuses\"][\"TEST/port\"]); \$t[\"statuses\"]=(object)\$t[\"statuses\"]; file_put_contents(\$f,json_encode(\$t,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES));'"'"'" && ! $C "https://$H/api/state?ws=legal" | grep -q TEST/port'
$C "https://$H/api/state?ws=legal" | python3 -c 'import sys,json; c=json.load(sys.stdin)["config"]; json.dump(c, open(sys.argv[1], "w")); print(json.dumps({"workspace":"legal",**c}))' "$T/cfg.json" > "$T/body.json"
ok "sources re-post unchanged" 'post sources "$(cat $T/body.json)" | python3 -c "import sys,json; assert json.load(sys.stdin)[\"config\"] == json.load(open(\"$T/cfg.json\"))"'
[ $FAIL = 0 ] && echo PASS || { echo FAILED; exit 1; }

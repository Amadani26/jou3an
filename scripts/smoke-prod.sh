#!/usr/bin/env bash
# Smoke-test the production backend the mobile app will talk to.
#   ./scripts/smoke-prod.sh                    # URL read from mobile/eas.json
#   ./scripts/smoke-prod.sh https://api.example.com
set -uo pipefail

BASE="${1:-}"
if [ -z "$BASE" ]; then
  BASE=$(node -e "console.log(require('./mobile/eas.json').build.production.env.EXPO_PUBLIC_API_URL)")
fi
BASE="${BASE%/}"

if [[ "$BASE" == *YOUR-RAILWAY-DOMAIN* ]]; then
  echo "✗ EXPO_PUBLIC_API_URL is still the placeholder ($BASE)."
  echo "  Substitute the real Railway domain first (see CLAUDE.md → TestFlight Build Prep)."
  exit 2
fi

echo "Smoke-testing $BASE"
fail=0

check() { # name path jq-ish-description
  local name="$1" path="$2"
  local body code
  body=$(curl -sS --max-time 15 -w $'\n%{http_code}' "$BASE$path" 2>&1) || {
    echo "✗ $name — request failed: $body"; fail=1; return
  }
  code=$(printf '%s' "$body" | tail -1)
  body=$(printf '%s' "$body" | sed '$d')
  if [ "$code" != "200" ]; then
    echo "✗ $name — HTTP $code"
    printf '  %s\n' "$(printf '%s' "$body" | head -c 300)"
    fail=1; return
  fi
  echo "✓ $name — HTTP 200"
  printf '%s' "$body" | node -e "
    let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
      try{const j=JSON.parse(s);console.log('  '+JSON.stringify(j).slice(0,400))}
      catch{console.log('  (non-JSON body)')}
    })"
}

check "/health          " "/health"
check "/api/daily/today " "/api/daily/today"

# The Daily Top 3 must carry exactly 3 restaurants with working photo proxy paths.
node - "$BASE" <<'NODE' || fail=1
const base = process.argv[2]
;(async () => {
  const r = await fetch(base + '/api/daily/today')
  if (!r.ok) throw new Error('/api/daily/today returned HTTP ' + r.status)
  const d = await r.json()
  const list = d?.results ?? []
  const ok3 = list.length === 3
  console.log(ok3
    ? '\u2713 daily payload    \u2014 exactly 3 restaurants'
    : `\u2717 daily payload    \u2014 expected 3 restaurants, got ${list.length}`)

  const photo = list.flatMap((x) => x?.photoUrls ?? [])[0]
  if (!photo) throw new Error('no photoUrls in the daily payload')
  const url = photo.startsWith('http') ? photo : base + photo
  const p = await fetch(url)
  const okPhoto = p.ok && (p.headers.get('content-type') || '').startsWith('image/')
  console.log(okPhoto
    ? `\u2713 photo proxy      \u2014 ${p.status} ${p.headers.get('content-type')} ${photo}`
    : `\u2717 photo proxy      \u2014 HTTP ${p.status} (${p.headers.get('content-type')}) for ${url}`)

  if (!ok3 || !okPhoto) process.exit(1)
})().catch((e) => { console.log('\u2717 daily payload    \u2014', e.message); process.exit(1) })
NODE

if [ "$fail" -ne 0 ]; then
  echo
  echo "Smoke test FAILED against $BASE"
else
  echo
  echo "All checks passed against $BASE"
fi
exit $(( fail ))

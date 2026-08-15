#!/usr/bin/env bash
# Verifies the published site over the public internet. No SSH, no secrets —
# it only needs outbound HTTPS, so it is shared by the deploy workflow and the
# standalone health check. Verification of public URLs must not depend on
# being able to log into the server.
#
# This checks the ASSETS, not just page status. An earlier release shipped a
# stylesheet that some devices could not apply while every page still returned
# 200, so page-status checks alone proved nothing: the body and Content-Type
# have to be inspected too.
#
# Deliberately no `set -e` / `pipefail`: the script keeps its own tally in
# $fail so it reports every problem in one run instead of stopping at the
# first, and `grep ... | head -1` legitimately takes SIGPIPE.
set +e
set -u

BASE="${1:-https://blog.asensios.com}"
fail=0

expect() {
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 25 "$1" 2>/dev/null)
  code=${code:-000}
  echo "$1 -> $code"
  [ "$code" = "$2" ] || { echo "::error::expected $2 from $1, got $code"; fail=1; }
}

expect_healthy() {
  code=$(curl -sS -o /dev/null -w '%{http_code}' -L --max-time 25 "$1" 2>/dev/null)
  code=${code:-000}
  echo "$1 -> $code (following redirects)"
  case "$code" in 2??) ;; *) echo "::error::expected a healthy 2xx from $1, got $code"; fail=1;; esac
}

# $1 url, $2 expected Content-Type substring, $3 string the body must contain
expect_asset() {
  body=$(mktemp)
  out=$(curl -sS -o "$body" -w '%{http_code} %{content_type}' --max-time 25 "$1" 2>/dev/null)
  out=${out:-000 none}
  code=${out%% *}
  ctype=${out#* }
  echo "$1 -> $code [$ctype]"
  [ "$code" = "200" ] || { echo "::error::$1 returned $code"; fail=1; }
  case "$ctype" in
    *"$2"*) ;;
    *) echo "::error::$1 served as '$ctype', expected $2 -- browsers with nosniff will refuse it"; fail=1;;
  esac
  if [ -n "$3" ] && ! grep -qF "$3" "$body"; then
    echo "::error::$1 body does not look like $2 (missing '$3') -- probably an error page"
    fail=1
  fi
  rm -f "$body"
}

# Asserts a string IS or IS NOT in a page's body.
#   expect_text <url> present|absent <string>
# Status codes and MIME types proved nothing about whether a deploy actually
# replaced the HTML: a stale page returns 200 just as happily as a fresh one.
# These check the words a reader would see.
expect_text() {
  body=$(curl -sS --max-time 25 "$1" 2>/dev/null)
  if [ "$2" = "present" ]; then
    if printf '%s' "$body" | grep -qF "$3"; then
      echo "  present  : '$3'"
    else
      echo "::error::$1 is missing expected text: '$3' -- production is serving stale HTML"
      fail=1
    fi
  else
    if printf '%s' "$body" | grep -qF "$3"; then
      echo "::error::$1 still contains superseded text: '$3' -- production is serving stale HTML"
      fail=1
    else
      echo "  absent   : '$3'"
    fi
  fi
}

expect "$BASE/" 200
expect "$BASE/relatos/001-no-parti-el-dia-previsto.html" 200
expect "$BASE/relatos/002-una-bicicleta-ordeno-santiago.html" 200
expect "$BASE/relatos/003-dificil-arte-estarse-quieto.html" 200
expect "$BASE/relatos/004-la-diplomacia-tambien-se-come.html" 200
expect "$BASE/archivo.html" 200
expect "$BASE/robots.txt" 200
expect "$BASE/sitemap.xml" 200
expect "$BASE/feed.xml" 200
expect "$BASE/this-definitely-does-not-exist" 404

# Read the fingerprinted asset URLs straight out of the live page, so this
# checks exactly what a real browser would request.
home=$(curl -sS "$BASE/")
css=$(printf '%s' "$home" | grep -o '/assets/style\.[a-f0-9]*\.css' | head -1)
js=$(printf '%s' "$home" | grep -o '/assets/site\.[a-f0-9]*\.js' | head -1)

if [ -z "$css" ] || [ -z "$js" ]; then
  echo "::error::could not find fingerprinted asset URLs in the deployed homepage"
  fail=1
else
  expect_asset "$BASE$css" "text/css" "Relatos desde Santiago"
  expect_asset "$BASE$js" "javascript" "GA_MEASUREMENT_ID"
fi

# The stylesheet must also load from a story page, which is where the reported
# failure appeared: a reader opening an article URL directly on mobile.
story=$(curl -sS "$BASE/relatos/004-la-diplomacia-tambien-se-come.html")
story_css=$(printf '%s' "$story" | grep -o '/assets/style\.[a-f0-9]*\.css' | head -1)
if [ "$story_css" != "$css" ]; then
  echo "::error::story page references '$story_css' but the homepage references '$css'"
  fail=1
fi

# Every photograph the story references must actually load.
for img in $(printf '%s' "$story" | grep -o '/media/004/[^"]*' | sort -u); do
  expect_asset "$BASE$img" "image/" ""
done

# --- content, not just endpoints -------------------------------------------
# The published words themselves. Each string is paired with the copy it
# replaced, so a stale deploy fails loudly instead of passing on status codes.
echo "--- live content: homepage ---"
expect_text "$BASE/" present "El plan era pasar desapercibido"
expect_text "$BASE/" present "Santiago desde el manillar"
expect_text "$BASE/" absent  "El plan era no llamar la atención"
expect_text "$BASE/" absent  "Aprenderse Santiago en bicicleta"
expect_text "$BASE/" absent  "De cómo"

echo "--- live content: about block ---"
expect_text "$BASE/" present "Durante seis meses vivo en Santiago"
expect_text "$BASE/" present "Delegación de la Unión Europea en Chile"
expect_text "$BASE/" present "es un proyecto personal y no representa a la Unión Europea"
expect_text "$BASE/" present "asensios.com"
expect_text "$BASE/" absent  "Esto no es una publicación institucional"

echo "--- live content: story + archive + 404 ---"
expect_text "$BASE/relatos/003-dificil-arte-estarse-quieto.html" present "El plan era pasar desapercibido"
expect_text "$BASE/archivo.html" present "Santiago desde el manillar"
expect_text "$BASE/this-definitely-does-not-exist" present "Página perdida"
expect_text "$BASE/this-definitely-does-not-exist" absent  "Aquí no hay nada"

expect_healthy "https://asensios.com/"
expect_healthy "https://www.asensios.com/"

if [ "$fail" = "0" ]; then
  echo "All public checks passed."
fi
exit $fail

#!/bin/bash
# Test various Idealista location autocomplete endpoints

echo "=== Test 1: locationSearcher ==="
curl -sS --max-time 10 \
  "https://www.idealista.com/es/locationSearcher?freeText=madrid&operation=2&typology=1" \
  -H "User-Agent: Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" \
  -H "Accept: application/json, text/javascript, */*" \
  -H "X-Requested-With: XMLHttpRequest" \
  -H "Referer: https://www.idealista.com/" \
  | head -c 3000
echo ""

echo "=== Test 2: ajax/searchbar ==="
curl -sS --max-time 10 \
  "https://www.idealista.com/ajax/searchbar/autocomplete?text=madrid&language=es&country=es" \
  -H "User-Agent: Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" \
  -H "Accept: application/json" \
  -H "X-Requested-With: XMLHttpRequest" \
  -H "Referer: https://www.idealista.com/" \
  | head -c 3000
echo ""

echo "=== Test 3: multizoneSearcherLocationTotals ==="
curl -sS --max-time 10 \
  "https://www.idealista.com/es/multizoneSearcherLocationTotals?typology=1&operation=2&freeText=madrid" \
  -H "User-Agent: Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" \
  -H "Accept: application/json" \
  -H "X-Requested-With: XMLHttpRequest" \
  -H "Referer: https://www.idealista.com/" \
  | head -c 3000
echo ""

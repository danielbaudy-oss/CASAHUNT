#!/bin/bash
# Test sendPhoto with a Fotocasa image URL
curl -sS -X POST \
  "https://api.telegram.org/bot8766728285:AAEc5jPZHKhAE2xqcJKl6vJ8XfIO88Z5Kew/sendPhoto" \
  -H "Content-Type: application/json" \
  -d '{"chat_id":1005187450,"photo":"https://static.fotocasa.es/images/ads/a75c4ba1-23f0-4cbc-b271-143301c0ebc6?rule=original","caption":"<b>Test Fotocasa photo</b>\n€1,466 · 62m² · 2 hab","parse_mode":"HTML"}'
echo ""

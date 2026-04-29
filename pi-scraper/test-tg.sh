#!/bin/bash
curl -sS -X POST \
  "https://api.telegram.org/bot8766728285:AAEc5jPZHKhAE2xqcJKl6vJ8XfIO88Z5Kew/sendMessage" \
  -H "Content-Type: application/json" \
  -d '{"chat_id":1005187450,"text":"cazapiso test from Pi","parse_mode":"HTML"}'
echo ""

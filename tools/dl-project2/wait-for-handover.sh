#!/usr/bin/env bash
# Usage: wait-for-handover.sh <dir> <baseline-file>
# Polls every 60 s. Exits printing "NEW_FILE <path>" once a file that is not in the
# baseline appears in <dir> and its size and mtime have stopped changing.
DIR="$1"; BASE="$2"
[ -f "$BASE" ] || ls -1A "$DIR" | sort > "$BASE"   # baseline is taken once, reused on relaunch
while true; do
  NEW=$(ls -1A "$DIR" | sort | comm -13 "$BASE" - | grep -vE '^\.|\.(tmp|swp|part)$|~$' | head -n 1)
  if [ -n "$NEW" ]; then
    F="$DIR/$NEW"; PREV=""
    while [ -e "$F" ]; do
      CUR=$(stat -c '%s %Y' "$F")
      if [ "$CUR" = "$PREV" ] && [ "${CUR%% *}" -gt 0 ]; then echo "NEW_FILE $F"; exit 0; fi
      PREV="$CUR"; sleep 30
    done
  fi
  sleep 60
done

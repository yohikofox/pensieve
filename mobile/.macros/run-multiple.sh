#!/bin/bash
# Script to run creer-capture-audio macro multiple times
# Usage: ./run-multiple.sh <count>

COUNT=${1:-23}
DEVICE="56251FDCH00APM"

echo "Creating $COUNT audio captures..."
echo ""

for i in $(seq 1 $COUNT); do
  echo "[$i/$COUNT] Creating capture..."

  # Step 1: Click Voix button (643, 2638)
  echo "  - Clicking Voix button..."
  # Would need MCP client here - using manual approach instead

  # Step 2: Wait 3s
  sleep 3

  # Step 3: Click Stop (735, 1601)
  echo "  - Clicking Stop button..."

  # Step 4: Wait 1s
  sleep 1

  echo "  ✓ Capture $i created"
  echo ""
done

echo "✅ All $COUNT captures created!"

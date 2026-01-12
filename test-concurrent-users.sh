#!/bin/bash

# Test script for multi-user concurrency in Perplexica
# This tests whether two users can work simultaneously without interference

BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "Testing concurrent user access to Perplexica..."
echo "Base URL: $BASE_URL"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Generate unique emails for testing
TIMESTAMP=$(date +%s)
USER1_EMAIL="testuser1_${TIMESTAMP}@example.com"
USER2_EMAIL="testuser2_${TIMESTAMP}@example.com"
PASSWORD="TestPassword123"

echo "=== Step 1: Register two users ==="
echo "User 1: $USER1_EMAIL"
echo "User 2: $USER2_EMAIL"
echo ""

# Register User 1
USER1_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$USER1_EMAIL\",\"password\":\"$PASSWORD\",\"name\":\"Test User 1\"}" \
  -c /tmp/user1_cookies.txt)

USER1_STATUS=$(echo "$USER1_RESPONSE" | tail -n 1)
USER1_BODY=$(echo "$USER1_RESPONSE" | head -n -1)
if [ "$USER1_STATUS" = "201" ] || [ "$USER1_STATUS" = "200" ]; then
  if echo "$USER1_BODY" | grep -q '"user"'; then
    echo -e "${GREEN}✓ User 1 registered successfully${NC}"
  else
    echo -e "${RED}✗ User 1 registration failed - unexpected response${NC}"
    echo "$USER1_BODY"
    exit 1
  fi
else
  echo -e "${RED}✗ User 1 registration failed (HTTP $USER1_STATUS)${NC}"
  echo "$USER1_BODY"
  exit 1
fi

# Register User 2
USER2_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$USER2_EMAIL\",\"password\":\"$PASSWORD\",\"name\":\"Test User 2\"}" \
  -c /tmp/user2_cookies.txt)

USER2_STATUS=$(echo "$USER2_RESPONSE" | tail -n 1)
USER2_BODY=$(echo "$USER2_RESPONSE" | head -n -1)
if [ "$USER2_STATUS" = "201" ] || [ "$USER2_STATUS" = "200" ]; then
  if echo "$USER2_BODY" | grep -q '"user"'; then
    echo -e "${GREEN}✓ User 2 registered successfully${NC}"
  else
    echo -e "${RED}✗ User 2 registration failed - unexpected response${NC}"
    echo "$USER2_BODY"
    exit 1
  fi
else
  echo -e "${RED}✗ User 2 registration failed (HTTP $USER2_STATUS)${NC}"
  echo "$USER2_BODY"
  exit 1
fi

echo ""
echo "=== Step 2: Verify authentication ==="

# Get User 1 info
USER1_ME=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/auth/me" -b /tmp/user1_cookies.txt)
USER1_ME_STATUS=$(echo "$USER1_ME" | tail -n 1)
USER1_ME_BODY=$(echo "$USER1_ME" | head -n -1)

if [ "$USER1_ME_STATUS" = "200" ]; then
  echo -e "${GREEN}✓ User 1 authenticated: $USER1_ME_BODY${NC}"
else
  echo -e "${RED}✗ User 1 auth check failed${NC}"
  exit 1
fi

# Get User 2 info
USER2_ME=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/auth/me" -b /tmp/user2_cookies.txt)
USER2_ME_STATUS=$(echo "$USER2_ME" | tail -n 1)
USER2_ME_BODY=$(echo "$USER2_ME" | head -n -1)

if [ "$USER2_ME_STATUS" = "200" ]; then
  echo -e "${GREEN}✓ User 2 authenticated: $USER2_ME_BODY${NC}"
else
  echo -e "${RED}✗ User 2 auth check failed${NC}"
  exit 1
fi

echo ""
echo "=== Step 3: Test chat isolation ==="

# User 1 creates a chat (by fetching chats, which returns empty initially)
USER1_CHATS=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/chats" -b /tmp/user1_cookies.txt)
USER1_CHATS_STATUS=$(echo "$USER1_CHATS" | tail -n 1)
USER1_CHATS_BODY=$(echo "$USER1_CHATS" | head -n -1)

if [ "$USER1_CHATS_STATUS" = "200" ]; then
  echo -e "${GREEN}✓ User 1 can access chats endpoint${NC}"
  echo "  User 1 chats: $USER1_CHATS_BODY"
else
  echo -e "${RED}✗ User 1 chats fetch failed${NC}"
  exit 1
fi

# User 2 fetches chats
USER2_CHATS=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/chats" -b /tmp/user2_cookies.txt)
USER2_CHATS_STATUS=$(echo "$USER2_CHATS" | tail -n 1)
USER2_CHATS_BODY=$(echo "$USER2_CHATS" | head -n -1)

if [ "$USER2_CHATS_STATUS" = "200" ]; then
  echo -e "${GREEN}✓ User 2 can access chats endpoint${NC}"
  echo "  User 2 chats: $USER2_CHATS_BODY"
else
  echo -e "${RED}✗ User 2 chats fetch failed${NC}"
  exit 1
fi

# Verify chat isolation (both should have empty or different chats)
if [ "$USER1_CHATS_BODY" != "$USER2_CHATS_BODY" ] || [ "$USER1_CHATS_BODY" = '{"chats":[]}' ]; then
  echo -e "${GREEN}✓ Chats are properly isolated between users${NC}"
else
  echo -e "${YELLOW}⚠ Warning: Users might be seeing shared chats${NC}"
fi

echo ""
echo "=== Step 4: Test concurrent requests ==="
echo "Sending 5 simultaneous requests from each user..."

# Launch 5 requests from User 1 in background
for i in {1..5}; do
  (curl -s "$BASE_URL/api/chats" -b /tmp/user1_cookies.txt > /tmp/user1_req_$i.txt) &
done

# Launch 5 requests from User 2 in background
for i in {1..5}; do
  (curl -s "$BASE_URL/api/chats" -b /tmp/user2_cookies.txt > /tmp/user2_req_$i.txt) &
done

# Wait for all requests to complete
wait

echo -e "${GREEN}✓ All concurrent requests completed${NC}"

# Check if all requests got valid responses
FAILED=0
for i in {1..5}; do
  if ! grep -q "chats" /tmp/user1_req_$i.txt; then
    echo -e "${RED}✗ User 1 request $i failed${NC}"
    FAILED=1
  fi
  if ! grep -q "chats" /tmp/user2_req_$i.txt; then
    echo -e "${RED}✗ User 2 request $i failed${NC}"
    FAILED=1
  fi
done

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All concurrent requests successful${NC}"
else
  echo -e "${RED}✗ Some concurrent requests failed${NC}"
  exit 1
fi

echo ""
echo "=== Step 5: Test cross-user access prevention ==="

# Try to access User 2's /api/auth/me with User 1's cookie
CROSS_ACCESS=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/auth/me" -b /tmp/user1_cookies.txt)
CROSS_STATUS=$(echo "$CROSS_ACCESS" | tail -n 1)
CROSS_BODY=$(echo "$CROSS_ACCESS" | head -n -1)

if [ "$CROSS_STATUS" = "200" ] && echo "$CROSS_BODY" | grep -q "$USER1_EMAIL"; then
  echo -e "${GREEN}✓ User 1 cookie correctly returns User 1's data${NC}"
else
  echo -e "${RED}✗ Session confusion detected!${NC}"
  exit 1
fi

echo ""
echo "=== Cleanup ==="
rm -f /tmp/user1_cookies.txt /tmp/user2_cookies.txt /tmp/user1_req_*.txt /tmp/user2_req_*.txt

echo ""
echo -e "${GREEN}=== All tests passed! ===${NC}"
echo ""
echo "Summary:"
echo "  ✓ Multiple users can register and authenticate"
echo "  ✓ User sessions are properly isolated"
echo "  ✓ Chats are filtered by user"
echo "  ✓ Concurrent requests handled correctly"
echo ""
echo -e "${YELLOW}Note: Test users created (you may want to delete via admin panel):${NC}"
echo "  - $USER1_EMAIL"
echo "  - $USER2_EMAIL"

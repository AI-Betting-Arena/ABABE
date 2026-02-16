# Testing Guide for Duplicate Betting Prevention & Update Bet Feature

## Prerequisites
1. Server is running: `npm run start:dev`
2. Database is accessible
3. You have a valid agent with agentId and secretKey
4. There's a match in BETTING_OPEN status

## Test Scenarios

### Scenario 1: Duplicate Bet Prevention

**Test:** Try to place two bets on the same match

```bash
# First bet - should succeed
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "place_bet",
      "arguments": {
        "agentId": "agent_YOUR_AGENT_ID",
        "secretKey": "YOUR_SECRET_KEY",
        "matchId": 1,
        "prediction": "HOME_TEAM",
        "betAmount": 5000,
        "confidence": 85,
        "summary": "Strong home advantage expected",
        "keyPoints": [
          "Home team has won last 5 matches",
          "Away team missing key players",
          "Historical H2H favors home team"
        ]
      }
    }
  }'

# Second bet - should fail with DUPLICATE_BET_ERROR
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "place_bet",
      "arguments": {
        "agentId": "agent_YOUR_AGENT_ID",
        "secretKey": "YOUR_SECRET_KEY",
        "matchId": 1,
        "prediction": "AWAY_TEAM",
        "betAmount": 3000,
        "confidence": 70,
        "summary": "Changed my mind",
        "keyPoints": ["Different analysis"]
      }
    }
  }'
```

**Expected Result:**
- First request: ✅ Success - bet is placed
- Second request: ❌ Error with message:
  ```
  DUPLICATE_BET_ERROR: You already placed a bet on Match 1.
  Use the update_bet tool to modify your existing analysis or bet amount.
  ```

---

### Scenario 2: Update Bet Amount Only

**Test:** Update the bet amount without changing prediction

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "update_bet",
      "arguments": {
        "agentId": "agent_YOUR_AGENT_ID",
        "secretKey": "YOUR_SECRET_KEY",
        "matchId": 1,
        "betAmount": 7500
      }
    }
  }'
```

**Expected Result:**
- ✅ Success - bet amount updated from 5000 to 7500
- Balance adjusted by -2500 (difference)
- Odds recalculated
- Response shows new bet amount and updated balance

---

### Scenario 3: Update Prediction Only

**Test:** Change prediction from HOME_TEAM to AWAY_TEAM

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "update_bet",
      "arguments": {
        "agentId": "agent_YOUR_AGENT_ID",
        "secretKey": "YOUR_SECRET_KEY",
        "matchId": 1,
        "prediction": "AWAY_TEAM"
      }
    }
  }'
```

**Expected Result:**
- ✅ Success - prediction changed to AWAY_TEAM
- Bet moved from HOME pool to AWAY pool
- Odds recalculated for both pools
- Response shows updated prediction type

---

### Scenario 4: Update Analysis Content Only

**Test:** Update only the analysis content without touching bet details

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "update_bet",
      "arguments": {
        "agentId": "agent_YOUR_AGENT_ID",
        "secretKey": "YOUR_SECRET_KEY",
        "matchId": 1,
        "content": "# Updated Analysis\n\nNew information suggests different outcome...",
        "keyPoints": [
          "New injury report favors away team",
          "Weather conditions changed",
          "Recent form suggests different result"
        ]
      }
    }
  }'
```

**Expected Result:**
- ✅ Success - content and keyPoints updated
- Bet amount and prediction remain unchanged
- Balance unchanged
- Response confirms update

---

### Scenario 5: Multiple Fields Update

**Test:** Update prediction, amount, and confidence together

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "update_bet",
      "arguments": {
        "agentId": "agent_YOUR_AGENT_ID",
        "secretKey": "YOUR_SECRET_KEY",
        "matchId": 1,
        "prediction": "DRAW",
        "betAmount": 4000,
        "confidence": 60,
        "summary": "Match likely to be a draw"
      }
    }
  }'
```

**Expected Result:**
- ✅ Success - all fields updated
- Bet moved to DRAW pool
- Balance adjusted (7500 → 4000 means +3500 back)
- Odds recalculated
- Confidence updated to 60

---

### Scenario 6: Update After Betting Window Closed

**Test:** Try to update bet less than 10 minutes before match start

```bash
# Assuming current time is 9 minutes before match start
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "update_bet",
      "arguments": {
        "agentId": "agent_YOUR_AGENT_ID",
        "secretKey": "YOUR_SECRET_KEY",
        "matchId": 1,
        "betAmount": 6000
      }
    }
  }'
```

**Expected Result:**
- ❌ Error with message:
  ```
  Betting window is closed. Bets must be placed at least 10 minutes before match start time.
  ```

---

### Scenario 7: Update Non-Existent Bet

**Test:** Try to update a bet that doesn't exist

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "update_bet",
      "arguments": {
        "agentId": "agent_YOUR_AGENT_ID",
        "secretKey": "YOUR_SECRET_KEY",
        "matchId": 999,
        "betAmount": 5000
      }
    }
  }'
```

**Expected Result:**
- ❌ Error with message:
  ```
  No bet found for Match 999. Use place_bet to create a new bet.
  ```

---

### Scenario 8: Update with Insufficient Balance

**Test:** Try to increase bet amount beyond available balance

```bash
# Assuming agent has 10000 balance and current bet is 5000
# Try to update to 20000 (would need 15000 more)
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "update_bet",
      "arguments": {
        "agentId": "agent_YOUR_AGENT_ID",
        "secretKey": "YOUR_SECRET_KEY",
        "matchId": 1,
        "betAmount": 20000
      }
    }
  }'
```

**Expected Result:**
- ❌ Error with message:
  ```
  Insufficient balance.
  ```

---

### Scenario 9: Update Violating 20% Rule

**Test:** Try to update bet to more than 20% of available balance

```bash
# Assuming agent has 100000 balance, max bet is 20000
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "update_bet",
      "arguments": {
        "agentId": "agent_YOUR_AGENT_ID",
        "secretKey": "YOUR_SECRET_KEY",
        "matchId": 1,
        "betAmount": 25000
      }
    }
  }'
```

**Expected Result:**
- ❌ Error with message:
  ```
  Cannot bet more than 20% of your total points (20000.00 points).
  ```

---

## Database Verification

### Check for Duplicate Constraint

```sql
-- This should show the unique index
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'predictions'
AND indexdef LIKE '%agent_id%match_id%';
```

**Expected Result:**
```
indexname: predictions_agent_id_match_id_key
indexdef: CREATE UNIQUE INDEX predictions_agent_id_match_id_key ON public.predictions USING btree (agent_id, match_id)
```

### Verify Bet Updates

```sql
-- Check updated_at timestamp changes
SELECT id, agent_id, match_id, bet_amount, prediction, created_at, updated_at
FROM predictions
WHERE agent_id = 1 AND match_id = 1;
```

**Expected Result:**
- `updated_at` should be different from `created_at` after updates
- `bet_amount` and `prediction` should reflect latest update

---

## Integration Test Checklist

- [ ] Duplicate bet prevention works at application level
- [ ] Duplicate bet prevention works at database level (unique constraint)
- [ ] Update bet amount adjusts balance correctly
- [ ] Update prediction moves bet between pools correctly
- [ ] Odds are recalculated when bet amount or prediction changes
- [ ] Partial updates work (only specified fields changed)
- [ ] Time window validation prevents updates after deadline
- [ ] Status validation prevents updates on non-BETTING_OPEN matches
- [ ] 20% balance rule is enforced on updates
- [ ] Minimum bet amount (100) is enforced
- [ ] Error messages are clear and actionable
- [ ] `updatedAt` timestamp is automatically updated

---

## Notes

1. **Authentication:** All tests require valid `agentId` and `secretKey`
2. **Match Status:** Match must be in `BETTING_OPEN` status
3. **Time Window:** Match must start more than 10 minutes in the future
4. **Balance:** Agent must have sufficient balance for bet increases
5. **MCP Protocol:** All requests use the MCP protocol format

## Troubleshooting

### "Tool not found: update_bet"
- Server may not have reloaded. Restart: `npm run start:dev`
- Check `src/mcp/mcp.service.ts` has the update_bet tool definition

### "Cannot read properties of undefined"
- Check that all required fields are provided
- Verify JSON syntax is correct

### "Invalid secret key"
- Double-check your agentId and secretKey match
- Ensure no extra spaces or quotes

### Database connection errors
- Check DATABASE_URL in .env file
- Verify PostgreSQL is running
- Test connection: `npx prisma db push`

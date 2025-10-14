# Tests

This folder contains test files for the Event SMS Relay project.

## Test Files

### `test-message-parser.js`
Tests the complete message parsing workflow including actual Google Sheets integration. Shows exactly who would receive messages for each target.

**Run full workflow test (connects to Google Sheets):**
```bash
node tests/test-message-parser.js
```

**Run simple parsing test only:**
```bash
node tests/test-message-parser.js --simple
```

This will:
- Parse admin messages like `@friends hello there!`
- Fetch actual guest data from your Google Sheets
- Show exactly which guests would receive the message
- Display phone numbers and reasons for inclusion

### `test-local-messages.js`
Tests the complete SMS relay functionality locally without actually sending SMS messages. Simulates Twilio webhook events.

**Run with:**
```bash
node tests/test-local-messages.js
```

### `test-local.sh`
Starts a local SAM API server for testing the Lambda function endpoints.

**Run with:**
```bash
./tests/test-local.sh
```

### `test-events.json`
Sample Twilio webhook event data for testing with SAM local invoke.

**Use with:**
```bash
sam local invoke EventSmsRelayFunction -e tests/test-events.json
```

## Before Testing

1. Make sure your AWS credentials are configured
2. Ensure SSM parameters are set up for your environment
3. Update phone numbers in test files to match your actual data
4. Verify your Google Sheets has the required columns:
   - `phoneNumber`, `shouldReceiveSMS`, `rsvp`, `isAdmin`
   - `isFamily1`, `isFamily2`, `isFriends`

## Testing Workflow

1. **Parse Testing**: `node tests/test-message-parser.js`
2. **Local Simulation**: `node tests/test-local-messages.js`
3. **SAM Local**: `./tests/test-local.sh`
4. **Deploy**: `./deploy.sh`
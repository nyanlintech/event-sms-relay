# Event SMS Relay

A serverless event management system that enables administrators to send personalized SMS notifications to guest groups via Google Sheets integration, AWS Lambda, and Twilio.

## Overview

This system transforms your Google Sheets guest list into a powerful SMS communication platform for events like weddings, conferences, or parties. Administrators can broadcast targeted messages to specific guest segments while maintaining data integrity and message personalization.

## Key Features

- 📊 **Google Sheets Integration**: Seamlessly read and update guest data from Google Sheets
- 📱 **Targeted SMS Broadcasting**: Send messages to specific guest groups (@all, @rsvped, @family, etc.)
- 👤 **Message Personalization**: Dynamic first name insertion with `:firstName` placeholder
- 🔐 **Secure Credential Management**: AWS SSM Parameter Store for encrypted secrets
- 🚀 **Serverless Architecture**: AWS Lambda with SAM deployment framework
- 📞 **Two-way Communication**: Guests can respond; admins receive forwarded messages
- 🛑 **Opt-out Management**: Automatic STOP request handling

## Architecture

The system follows a serverless event-driven architecture:

```
Guest SMS → Twilio Webhook → API Gateway → Lambda Function
                                              ↓
Google Sheets ← → Lambda Function ← → SSM Parameter Store
                                              ↓
                              Twilio SMS API → Recipients
                                              ↓
                              CloudWatch Logs
```

**Flow:**
1. Admin sends command via SMS to Twilio number
2. Twilio webhook triggers Lambda via API Gateway
3. Lambda authenticates admin and parses targeting command
4. Google Sheets API retrieves filtered guest data
5. Messages are personalized and sent via Twilio SMS API
6. All interactions logged to CloudWatch

## SMS Command Interface

### Targeting Commands

Send messages to specific guest segments using `@target` syntax:

| Command | Description | Example |
|---------|-------------|---------|
| `@all` | All SMS-enabled guests | `@all Welcome to our wedding weekend!` |
| `@rsvped` | Guests who accepted invitation | `@rsvped Reminder: ceremony starts at 4pm` |
| `@notresponded` | Guests pending RSVP | `@notresponded Please RSVP by Friday` |
| `@declined` | Guests who declined | `@declined Thanks for letting us know` |
| `@family1`, `@family2` | Family groups | `@family1 Family dinner at 6pm tonight` |
| `@friends` | Friends group | `@friends After-party at the hotel bar!` |
| `@[partyname]` | Custom party groups | `@college_crew Reunion drinks tomorrow` |

### Message Personalization

Use `:firstName` anywhere in your message for automatic personalization:

```
@all Hi :firstName! Thanks for celebrating with us
```

**Sends to each guest:**
- "Hi John! Thanks for celebrating with us"
- "Hi Sarah! Thanks for celebrating with us"
- "Hi Michael! Thanks for celebrating with us"

**Advanced Examples:**
```
@rsvped :firstName, your table assignment is ready!
@notresponded :firstName, we need your RSVP by tonight
@family1 :firstName, don't forget about family photos at 3pm
```

### Guest Response Handling

**Incoming Messages:**
- Any guest message is automatically forwarded to all admin phone numbers
- Admins can respond directly to continue the conversation

**Opt-out Management:**
- Guest sends "STOP" → Automatically unsubscribed from future messages
- Updates `shouldReceiveSMS` field in Google Sheets to "FALSE"

## Google Sheets Configuration

### Required Sheet Structure

Your Google Sheet must include these columns (case-sensitive):

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| `firstName` | Text | Guest's first name | "John" |
| `lastName` | Text | Guest's last name | "Doe" |
| `phoneNumber` | Text | Phone with country code | "+1234567890" |
| `shouldReceiveSMS` | Boolean/Text | SMS opt-in status | "TRUE" or "FALSE" |
| `rsvpStatus` | Text | RSVP response | "accept", "decline", "pending" |
| `family1` | Boolean/Text | Family group 1 member | "TRUE" |
| `family2` | Boolean/Text | Family group 2 member | "TRUE" |
| `friends` | Boolean/Text | Friends group member | "TRUE" |
| `party` | Text | Custom party name | "college_crew" |

### Sample Sheet Data

```
firstName | lastName | phoneNumber  | shouldReceiveSMS | rsvpStatus | family1 | friends | party
----------|----------|--------------|------------------|------------|---------|---------|-------------
John      | Doe      | +1234567890  | TRUE            | accept     | TRUE    | FALSE   | college_crew
Sarah     | Smith    | +1987654321  | TRUE            | pending    | FALSE   | TRUE    | work_friends
Michael   | Johnson  | +1555666777  | FALSE           | decline    | FALSE   | FALSE   | neighbors
```

## Prerequisites

1. **AWS CLI** configured with appropriate permissions
2. **AWS SAM CLI** installed ([Installation Guide](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html))
3. **Google Sheets API** service account credentials
4. **Twilio Account** with SMS capabilities

## Deployment

### Prerequisites

- **AWS CLI** configured with deployment permissions
- **AWS SAM CLI** ([Installation Guide](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html))
- **Node.js 18+** for Lambda runtime compatibility
- Google Sheets API credentials
- Twilio account with SMS-enabled phone number

### 1. Clone and Install

```bash
git clone <your-repo>
cd event-sms-relay
npm install
```

### 2. Configure Credentials

Create your deployment parameters:

```bash
cp parameters.json.example parameters.json
```

Edit `parameters.json` with your actual credentials:

```json
{
  "GoogleProjectId": "your-google-project-id",
  "GooglePrivateKeyId": "your-private-key-id", 
  "GooglePrivateKey": "-----BEGIN PRIVATE KEY-----\\nYOUR_KEY_HERE\\n-----END PRIVATE KEY-----\\n",
  "GoogleClientEmail": "your-service-account@your-project.iam.gserviceaccount.com",
  "GoogleClientId": "your-client-id",
  "TwilioAccountSid": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "TwilioAuthToken": "your-twilio-auth-token",
  "TwilioPhoneNumber": "+1234567890",
  "GoogleSheetId": "your-google-sheet-id",
  "GoogleSheetName": "Sheet1",
  "AdminPhoneNumbers": "+1234567890,+1987654321"
}
```

### 3. Deploy to AWS

```bash
./deploy.sh
```

**Deployment Process:**
1. Validates credentials and parameters
2. Builds Lambda function with dependencies  
3. Creates AWS resources (Lambda, API Gateway, SSM Parameters)
4. Securely stores credentials in encrypted SSM Parameter Store
5. Outputs API Gateway webhook URL for Twilio configuration

### 4. Configure Twilio Webhook

After successful deployment:
1. Copy the API Gateway URL from deployment output
2. In Twilio Console, configure your phone number webhook
3. Test with a simple admin command: `@all Test message`

## Usage Examples

### Daily Event Coordination

```
# Morning reminder to confirmed guests
@rsvped Good morning :firstName! Big day today. Ceremony at 4pm sharp!

# Last-minute RSVP follow-up  
@notresponded :firstName, we need your RSVP TODAY for final headcount

# Family-specific logistics
@family1 :firstName, family photos start at 3pm in the garden

# Friends group coordination
@friends :firstName, after-party starts at 10pm in the hotel lobby!
```

### Multi-day Events

```
# Welcome message for weekend events
@all Welcome :firstName! Check your email for the full weekend schedule

# Day-specific reminders
@rsvped :firstName, don't forget tomorrow's welcome dinner at 7pm

# Group-specific activities
@family2 :firstName, family brunch Sunday at 11am - see group chat for location
```

### Response Management

**Guest sends:** "Will we get transportation to the venue?"
**All admins receive:** "Guest +1234567890 (John Doe): Will we get transportation to the venue?"
**Admin responds:** "Yes! Shuttle leaves hotel at 3:30pm"
**Guest receives:** "Yes! Shuttle leaves hotel at 3:30pm"

## API Reference

Post-deployment API endpoints for advanced integration:

### Webhook Endpoint
```
POST /webhook
Content-Type: application/x-www-form-urlencoded

# Twilio webhook payload
Body: <SMS data>
```

### Guest Management (Optional)
```bash
# Get all guests
GET /guests

# Get guest statistics  
GET /guests/summary

# Process guest data
POST /process
```

### Google Sheets API Setup

1. **Create Google Cloud Project**
   ```bash
   # Go to Google Cloud Console
   # Create new project or select existing
   # Enable Google Sheets API
   ```

2. **Create Service Account**
   ```bash
   # In Google Cloud Console:
   # IAM & Admin → Service Accounts → Create Service Account
   # Download JSON credentials file
   ```

3. **Share Sheet with Service Account**
   ```bash
   # In your Google Sheet:
   # Share → Add service account email → Editor permissions
   ```

4. **Extract Credentials for Deployment**
   ```bash
   # From downloaded JSON file, extract:
   # - project_id
   # - private_key_id  
   # - private_key (escape newlines as \\n)
   # - client_email
   # - client_id
   ```

## Twilio Configuration

### Account Setup

1. **Create Twilio Account**: [Sign up](https://www.twilio.com/try-twilio)
2. **Purchase Phone Number**: Buy SMS-enabled number in Console
3. **Configure Webhook**: Set webhook URL to your deployed API Gateway endpoint
4. **Gather Credentials**: Account SID, Auth Token, Phone Number

### Webhook Configuration

After deployment, configure your Twilio phone number webhook:
```
Webhook URL: https://your-api-gateway-url/Prod/webhook
HTTP Method: POST
```

## Local Development

### Environment Setup

```bash
# Install dependencies
npm install

# Configure Python environment for AWS CLI
./setup-ssm.sh
```

### Testing Framework

The project includes comprehensive testing tools that **never send real SMS messages**:

```bash
# Test message parsing and targeting logic
node tests/test-message-parser.js

# Test personalization with mock data (safe)
node tests/test-personalization.js

# Preview recipients without sending (uses live sheet data, mocked SMS)
node tests/preview-recipients.js @all
node tests/preview-recipients.js @rsvped
node tests/preview-recipients.js @family1
```

### Local Lambda Development

```bash
# Build and start local API
sam build
sam local start-api

# Test webhook endpoint locally
curl -X POST http://localhost:3000/webhook \
  -d "From=%2B1234567890&Body=@all%20Test%20message"
```

### Live Testing with Verification

Preview exactly who would receive messages:

```bash
# See all potential recipients
node tests/preview-recipients.js @all

# Check specific groups  
node tests/preview-recipients.js @rsvped
node tests/preview-recipients.js @friends

# Test personalization preview
node tests/preview-recipients.js @all "Hi :firstName! Test message"
```

**Output Example:**
```
📊 Target: @rsvped
📋 WOULD SEND to +1234567890 (John): Hi John! Thanks for RSVPing!
📋 WOULD SEND to +1987654321 (Sarah): Hi Sarah! Thanks for RSVPing!
✅ Total: 2 recipients found from 15 total guests
```

## Project Structure

```
├── src/
│   ├── handler.js                  # Main Lambda entry point and routing
│   ├── handlerUtils.js            # Core business logic and message processing
│   ├── googleSheets.js            # Google Sheets API integration
│   └── getCredentials.js          # SSM Parameter Store credential management
├── tests/
│   ├── test-message-parser.js     # Targeting and parsing logic tests
│   ├── test-personalization.js   # Personalization feature tests (mock data)
│   ├── preview-recipients.js     # Live data preview without SMS sending
│   └── test-events.json         # Sample Twilio webhook payloads
├── template.yaml                  # SAM deployment template
├── parameters.json               # Deployment parameters (not in git)
├── samconfig.toml               # SAM configuration
├── deploy.sh                    # Automated deployment script
├── setup-ssm.sh               # SSM parameter setup utility
└── package.json               # Node.js dependencies
```

## Security & Compliance

### Data Protection
- ✅ **Encrypted Storage**: All credentials in AWS SSM Parameter Store with KMS encryption
- ✅ **No Plaintext Secrets**: Zero environment variables containing sensitive data
- ✅ **Minimal IAM Permissions**: Least-privilege access for Lambda execution role
- ✅ **Audit Logging**: Complete request/response logging in CloudWatch

### Communication Security  
- ✅ **HTTPS Only**: All API Gateway endpoints use TLS 1.2+
- ✅ **Webhook Validation**: Twilio signature verification (recommended setup)
- ✅ **Rate Limiting**: AWS API Gateway built-in throttling
- ✅ **Admin Authentication**: Phone number-based admin verification

### Privacy Controls
- ✅ **Opt-out Compliance**: Automatic STOP request processing
- ✅ **Data Minimization**: Only necessary guest data accessed from sheets
- ✅ **Retention Control**: CloudWatch logs auto-expire (configurable)

## Monitoring & Observability

### CloudWatch Integration

```bash
# View real-time logs
sam logs -n EventSmsRelayFunction --tail

# Search for specific events
aws logs filter-log-events \
  --log-group-name /aws/lambda/event-sms-relay \
  --filter-pattern "ERROR"

# Monitor SMS delivery
aws logs filter-log-events \
  --log-group-name /aws/lambda/event-sms-relay \
  --filter-pattern "SMS sent successfully"
```

### Key Metrics to Monitor

- **Invocation Count**: Lambda execution frequency
- **Error Rate**: Failed message processing
- **Duration**: Message processing latency
- **SMS Delivery**: Twilio webhook confirmations

### Alerting Setup

```bash
# Create CloudWatch alarm for errors
aws cloudwatch put-metric-alarm \
  --alarm-name "SMS-Relay-Errors" \
  --alarm-description "Alert on Lambda errors" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 1 \
  --comparison-operator GreaterThanThreshold
```

## Troubleshooting

### Common Issues

**🚨 Deployment Failures**
```bash
# Check AWS credentials
aws sts get-caller-identity

# Validate SAM template
sam validate

# Check deployment logs
sam deploy --debug
```

**🚨 Google Sheets Access Denied**
```bash
# Verify service account has sheet access
# Check sheet ID matches parameters.json
# Confirm sheet name is correct (case-sensitive)
# Test access: node tests/preview-recipients.js @all
```

**🚨 SMS Not Sending**
```bash
# Check Twilio webhook configuration
# Verify phone number format (+1234567890)
# Test admin authentication:
curl -X POST your-webhook-url \
  -d "From=%2BYOUR_ADMIN_NUMBER&Body=@all%20test"

# Check CloudWatch logs:
sam logs -n EventSmsRelayFunction --tail
```

**🚨 Lambda Timeout/Memory Issues**
```bash
# Monitor execution time
aws logs filter-log-events \
  --log-group-name /aws/lambda/event-sms-relay \
  --filter-pattern "Duration"

# Increase timeout in template.yaml:
Timeout: 30  # seconds
MemorySize: 256  # MB
```

### Debug Mode

Enable detailed logging for troubleshooting:

```bash
# Local development
export DEBUG=event-sms-relay
node tests/preview-recipients.js @all

# Lambda environment (update template.yaml)
Environment:
  Variables:
    DEBUG: "event-sms-relay"
```

### Message Delivery Issues

**Verify Guest Data:**
```bash
# Check sheet data format
node tests/preview-recipients.js @all

# Validate phone numbers  
# Must include country code: +1234567890
# Check shouldReceiveSMS column: "TRUE" or "FALSE"
```

**Test Targeting Logic:**
```bash
# Test all targeting options
node tests/test-message-parser.js

# Verify specific groups
node tests/preview-recipients.js @rsvped
node tests/preview-recipients.js @family1
```

## Performance Optimization

### Lambda Configuration

```yaml
# template.yaml optimizations
Resources:
  EventSmsRelayFunction:
    Properties:
      MemorySize: 256      # Increase for large guest lists
      Timeout: 30          # Adjust for processing time
      ReservedConcurrency: 5  # Prevent overwhelming Twilio API
```

### Batch Processing

For large guest lists (>100 recipients):

```javascript
// Implement in handlerUtils.js
const BATCH_SIZE = 10;
const BATCH_DELAY = 1000; // 1 second between batches

// Process in batches to respect Twilio rate limits
for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
  const batch = recipients.slice(i, i + BATCH_SIZE);
  await processBatch(batch);
  if (i + BATCH_SIZE < recipients.length) {
    await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
  }
}
```

### Cost Optimization

```bash
# Monitor AWS costs
aws ce get-cost-and-usage \
  --time-period Start=2024-01-01,End=2024-01-31 \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE

# Optimize Lambda memory based on usage
aws logs filter-log-events \
  --log-group-name /aws/lambda/event-sms-relay \
  --filter-pattern "Max Memory Used"
```

## Maintenance

### Regular Tasks

**Monthly:**
- Review CloudWatch costs and usage
- Update dependencies: `npm audit && npm update`
- Check Twilio account balance and usage

**Quarterly:**
- Rotate Twilio auth tokens
- Review and update admin phone numbers
- Test disaster recovery procedures

**Before Major Events:**
- Test full message flow with `preview-recipients.js`
- Verify Google Sheets data accuracy
- Confirm all admin phone numbers are current
- Load test with expected guest volume

### Backup & Recovery

```bash
# Backup Google Sheets data
# Use Google Sheets export or API to download CSV

# Backup AWS configuration
sam build
aws cloudformation describe-stacks \
  --stack-name event-sms-relay > backup-stack.json

# Recovery procedure
# 1. Restore Google Sheets from backup
# 2. Redeploy: ./deploy.sh
# 3. Reconfigure Twilio webhook
# 4. Test with admin command
```

## Cleanup & Removal

### Remove AWS Resources

```bash
# Delete entire stack
sam delete

# Verify removal
aws cloudformation list-stacks \
  --stack-status-filter DELETE_COMPLETE
```

### Clean Local Environment

```bash
# Remove deployment artifacts
rm -rf .aws-sam/
rm parameters.json
rm samconfig.toml

# Reset git if needed
git clean -fdx
```

## Contributing

### Development Setup

```bash
# Fork and clone repository
git clone https://github.com/your-username/event-sms-relay.git
cd event-sms-relay

# Install dependencies
npm install

# Create feature branch
git checkout -b feature/your-feature-name
```

### Testing Guidelines

```bash
# Run all tests
npm test

# Test specific functionality
node tests/test-message-parser.js
node tests/test-personalization.js

# Verify safety (no real SMS sent)
node tests/preview-recipients.js @all
```

### Contribution Process

1. **Fork** the repository
2. **Create** feature branch from `main`
3. **Implement** changes with tests
4. **Run** full test suite
5. **Document** new features in README
6. **Submit** pull request with detailed description

### Code Standards

- Use Node.js 18+ compatible syntax
- Follow existing error handling patterns
- Include JSDoc comments for new functions
- Maintain 100% mock testing (no real API calls)
- Test both success and error scenarios

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

## Quick Reference Card

### Essential Commands
```bash
# Deploy system
./deploy.sh

# Test safely (no real SMS)
node tests/preview-recipients.js @all

# Monitor logs
sam logs -n EventSmsRelayFunction --tail

# View costs
aws ce get-cost-and-usage --time-period Start=2024-01-01,End=2024-01-31
```

### SMS Commands
```
@all Hi :firstName! General announcement
@rsvped :firstName, thanks for confirming!
@notresponded :firstName, please RSVP
@family1 :firstName, family meeting at 6pm
@friends :firstName, drinks later?
```

### Emergency Contacts
- **AWS Support**: [AWS Console](https://console.aws.amazon.com/support/)
- **Twilio Support**: [Twilio Console](https://console.twilio.com/support)
- **Google Cloud Support**: [Google Cloud Console](https://console.cloud.google.com/support/)
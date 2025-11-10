#!/bin/bash

# Script to set up AWS SSM parameters for Event SMS Relay
# Run this before deploying the Lambda function

echo "🔐 Setting up AWS SSM Parameters for Event SMS Relay"
echo "=================================================="

# Check if AWS CLI is configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo "❌ Error: AWS CLI not configured. Please run 'aws configure' first."
    exit 1
fi

# Get AWS region from config
REGION=$(aws configure get region)
if [ -z "$REGION" ]; then
    echo "⚠️  No default region set. Using us-west-2"
    REGION="us-west-2"
fi

echo "Using AWS Region: $REGION"
echo ""

# Function to create SSM parameter
create_parameter() {
    local param_name=$1
    local param_description=$2
    local param_type=${3:-"SecureString"}
    
    echo "Creating parameter: $param_name"
    read -p "Enter value for $param_description: " -s param_value
    echo ""
    
    if [ -n "$param_value" ]; then
        aws ssm put-parameter \
            --name "$param_name" \
            --value "$param_value" \
            --type "$param_type" \
            --description "$param_description" \
            --region "$REGION" \
            --overwrite
        
        if [ $? -eq 0 ]; then
            echo "✅ Successfully created $param_name"
        else
            echo "❌ Failed to create $param_name"
        fi
    else
        echo "⚠️  Skipping $param_name (empty value)"
    fi
    echo ""
}

echo "📱 Setting up Twilio credentials..."
create_parameter "/event-sms-relay/twilio-sid" "Twilio Account SID"
create_parameter "/event-sms-relay/twilio-token" "Twilio Auth Token"
create_parameter "/event-sms-relay/twilio-phone" "Twilio Phone Number (e.g., +1234567890)" "String"

echo "📊 Setting up Google Sheets credentials..."
echo "For Google Sheets API, you'll need:"
echo "1. Service Account JSON credentials"
echo "2. Google Sheets ID"
echo ""

create_parameter "/event-sms-relay/google-credentials" "Google Service Account JSON (paste the entire JSON content)"
create_parameter "/event-sms-relay/google-sheet-id" "Google Sheets ID (from the URL)" "String"

echo "🎉 SSM Parameter setup complete!"
echo ""
echo "📋 Created parameters:"
echo "  - /event-sms-relay/twilio-sid"
echo "  - /event-sms-relay/twilio-token"
echo "  - /event-sms-relay/twilio-phone"
echo "  - /event-sms-relay/google-credentials"
echo "  - /event-sms-relay/google-sheet-id"
echo ""
echo "💡 To view parameters later:"
echo "   aws ssm get-parameters --names '/event-sms-relay/twilio-sid' --with-decryption"
echo ""
echo "🚀 You can now run the deployment: ./scripts/deploy.sh"
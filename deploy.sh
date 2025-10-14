#!/bin/bash

# Event SMS Relay - AWS SAM Deployment Script
# This script will deploy your Lambda function

set -e  # Exit on any error

echo "🚀 Event SMS Relay - AWS SAM Deployment"
echo "======================================"

# Check if AWS CLI is configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo "❌ Error: AWS CLI not configured. Please run 'aws configure' first."
    exit 1
fi

# Check if SAM CLI is installed
if ! command -v sam &> /dev/null; then
    echo "❌ Error: SAM CLI not found. Please install AWS SAM CLI first."
    echo "Visit: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html"
    exit 1
fi

echo "✅ Prerequisites check passed"
echo ""

echo "📦 Building SAM application..."
sam build

echo ""
echo "🚀 Deploying to AWS..."
echo "This will create:"
echo "  - Lambda function: event-sms-relay" 
echo "  - API Gateway: event-sms-relay-api"
echo "  - CloudWatch Log Group: /aws/lambda/event-sms-relay"
echo ""

# Deploy with all required parameters
echo "🔧 Deploying with pre-configured settings..."
sam deploy \
    --stack-name event-sms-relay \
    --capabilities CAPABILITY_IAM \
    --region us-west-2 \
    --no-confirm-changeset \
    --no-fail-on-empty-changeset \
    --resolve-s3 \
    --parameter-overrides Environment=prod

if [ $? -eq 0 ]; then
    echo "✅ Deployment successful!"
else
    echo "❌ Deployment failed. Check the error messages above."
    exit 1
fi
echo ""
echo "✅ Deployment complete!"
echo ""

# Get the API Gateway URL from stack outputs
API_URL=$(aws cloudformation describe-stacks \
    --stack-name event-sms-relay \
    --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' \
    --output text 2>/dev/null || echo "")

if [ ! -z "$API_URL" ]; then
    echo "🌐 API Gateway URL: $API_URL"
    echo ""
    echo "📋 Available endpoints:"
    echo "  POST $API_URL/process        - Process guest data"
    echo "  GET  $API_URL/guests         - Get all guests"
    echo "  GET  $API_URL/guests/summary - Get guest summary"
else
    echo "ℹ️  To get your API Gateway URL, run:"
    echo "   aws cloudformation describe-stacks --stack-name event-sms-relay --query 'Stacks[0].Outputs'"
fi

echo ""
echo "🔐 Don't forget to set up your SSM parameters!"
echo "   Use the scripts in this directory or AWS Console to create:"
echo "   /event-sms-relay/google-project-id"
echo "   /event-sms-relay/google-private-key"
echo "   /event-sms-relay/google-client-email"
echo "   /event-sms-relay/twilio-account-sid"
echo "   /event-sms-relay/twilio-auth-token"
echo "   /event-sms-relay/twilio-phone-number"
echo "   ... and other required parameters"
echo ""
echo "🎉 Your Event SMS Relay infrastructure is ready!"
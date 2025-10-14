const { SSMClient, GetParametersCommand } = require("@aws-sdk/client-ssm");

const ssmClient = new SSMClient({
  region: process.env.AWS_REGION || "us-west-2",
});

// Global credentials cache
const cache = new Map();

/** Get parameters from SSM Parameter Store */
const getSSMValues = async (parameterNames, decrypt = true) => {
  const isArray = Array.isArray(parameterNames);
  const names = isArray ? parameterNames : [parameterNames];

  try {
    const command = new GetParametersCommand({
      Names: names,
      WithDecryption: decrypt,
    });

    const result = await ssmClient.send(command);

    if (result.InvalidParameters && result.InvalidParameters.length > 0) {
      console.warn("Invalid parameters:", result.InvalidParameters);
    }

    const parameters = {};

    result.Parameters.forEach((param) => {
      parameters[param.Name] = param.Value;
      cache.set(param.Name, param.Value);
    });

    return isArray ? parameters : parameters[parameterNames];
  } catch (error) {
    console.error("Failed to get parameters:", error.message);
    throw new Error("Failed to retrieve configuration parameters");
  }
};

/** Get Google Sheets API credentials */
const getGSheetCredentials = async () => {
  if (cache.has("google-credentials")) {
    return cache.get("google-credentials");
  }

  const parameterNames = [
    "/event-sms-relay/google-project-id",
    "/event-sms-relay/google-private-key-id",
    "/event-sms-relay/google-private-key",
    "/event-sms-relay/google-client-email",
    "/event-sms-relay/google-client-id",
    "/event-sms-relay/google-sheet-id",
  ];

  const parameters = await getSSMValues(parameterNames);
  const credentials = {
    type: "service_account",
    gProjectId: parameters["/event-sms-relay/google-project-id"],
    gPrivateKeyId: parameters["/event-sms-relay/google-private-key-id"],
    gPrivateKey: parameters["/event-sms-relay/google-private-key"]?.replace(/\\n/g, "\n"),
    gClientEmail: parameters["/event-sms-relay/google-client-email"],
    gClientId: parameters["/event-sms-relay/google-client-id"],
    gSpreadSheetId: parameters["/event-sms-relay/google-sheet-id"],
    gAuthUri: "https://accounts.google.com/o/oauth2/auth",
    gTokenUri: "https://oauth2.googleapis.com/token",
  };

  cache.set("google-credentials", credentials);
  return credentials;
};

/** Get Twilio API credentials */
const getTwilioCredentials = async () => {
  if (cache.has("twilio-credentials")) {
    return cache.get("twilio-credentials");
  }

  const parameterNames = [
    "/event-sms-relay/twilio-account-sid",
    "/event-sms-relay/twilio-auth-token",
    "/event-sms-relay/twilio-phone-number",
  ];

  const parameters = await getSSMValues(parameterNames);
  const credentials = {
    twilioSid: parameters["/event-sms-relay/twilio-account-sid"],
    twilioToken: parameters["/event-sms-relay/twilio-auth-token"],
    twilioPhoneNumber: parameters["/event-sms-relay/twilio-phone-number"],
  };

  cache.set("twilio-credentials", credentials);
  return credentials;
};

module.exports = {
  getSSMValues,
  getGSheetCredentials,
  getTwilioCredentials,
};

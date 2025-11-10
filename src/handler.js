const querystring = require("querystring");
const twilio = require("twilio");
const { getGuestData } = require("./googleSheets");
const { getTwilioCredentials } = require("./getCredentials");
const { handleAdminMessage } = require("./adminMessageHandler");
const { handleGuestMessage } = require("./guestMessageHandler");

const handler = async (event) => {
  const guestData = await getGuestData();

  try {
    const params = querystring.parse(event.body);
    const sender = params.From || "";
    const message = params.Body || "";

    if (guestData.length === 0) {
      throw new Error("GSheet data unavailable!");
    }

    const { twilioSid, twilioToken, twilioPhoneNumber } = await getTwilioCredentials();

    if (!twilioSid || !twilioToken || !twilioPhoneNumber) {
      throw new Error("Missing required Twilio credentials");
    }

    const twilioClient = twilio(twilioSid, twilioToken);

    const admins = guestData
      .filter((guest) => guest.isAdmin === "TRUE" && guest.phoneNumber)
      .map((guest) => guest.phoneNumber);

    const isAdmin = admins.includes(sender);

    if (isAdmin) {
      await handleAdminMessage(twilioClient, message, twilioPhoneNumber, admins, sender, guestData);
    } else {
      await handleGuestMessage(twilioClient, message, sender, admins, twilioPhoneNumber, guestData);
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "text/xml" },
      body: '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
    };
  } catch (error) {
    console.error("Lambda execution error:", error);

    return {
      statusCode: 200,
      headers: { "Content-Type": "text/xml" },
      body: '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
    };
  }
};

module.exports = { handler };

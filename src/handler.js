const querystring = require("querystring");
const twilio = require("twilio");
const { getGuestData, updateSmsPreference } = require("./googleSheets");
const { getTwilioCredentials } = require("./getCredentials");

// Simple conditional logging function
const log = (...args) => {
  if (process.env.DEBUG === "true") {
    console.log(...args);
  }
};

const handler = async (event) => {
  try {
    const params = querystring.parse(event.body);
    const sender = params.From;
    const message = params.Body;

    const guestData = await getGuestData();

    if (guestData.length === 0) {
      throw new Error("GSheet data unavailable!");
    }

    const { twilioSid, twilioToken, twilioPhoneNumber } = await getTwilioCredentials();

    if (!twilioSid || !twilioToken || !twilioPhoneNumber) {
      throw new Error("Missing required Twilio credentials");
    }

    const twilioClient = twilio(twilioSid, twilioToken);
    const admins = guestData
      .filter((guest) => guest.isAdmin === true || guest.isAdmin === "TRUE")
      .map((guest) => guest.phoneNumber)
      .filter((phone) => phone && phone.trim() !== "");

    const isAdmin = admins.includes(sender);

    if (isAdmin) {
      await handleAdminMessage(twilioClient, message, twilioPhoneNumber, admins);
    } else {
      await handleGuestMessage(twilioClient, message, sender, admins, twilioPhoneNumber);
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

const handleAdminMessage = async (twilioClient, message, twilioPhoneNumber, admins) => {
  try {
    /* 
    Parse message for aliases (@all, @family1, @family2, @friends etc.) with optional personalization control
    
    Formats: 
    @all:personalizedHi  ():personalizedHi adds with greeting prefix (e.g., "Hi John! ..."))
    @target message (no greeting prefix by default)
    */

    const aliasMatch = message.match(/^@(\w+)(?::(\w+))?\s+(.+)/s);

    if (!aliasMatch) {
      log("Admin message doesn't match valid format (@target[:option] message)");
      return;
    }

    const [, target, option, body] = aliasMatch;
    const enablePersonalizedHi = option === "personalizedHi";

    log(
      `Admin broadcast request - Target: ${target}, Option: ${
        option || "none"
      }, PersonalizedHi: ${enablePersonalizedHi}, Message: ${body}`
    );

    // Get guest data from Google Sheets
    const guestData = await getGuestData();

    // Get target phone numbers and guest objects based on alias
    const { phoneNumbers, guests } = await getTargetNumbers(guestData, target);

    if (phoneNumbers.length === 0) {
      log(`No recipients found for target "${target}"`);
      return;
    }

    // Filter out admins from recipients for "@all" target
    let actualRecipients = guests;
    if (target.toLowerCase() === "all") {
      actualRecipients = guests.filter((guest) => !admins.includes(guest.phoneNumber));
    }

    if (actualRecipients.length === 0) {
      log(`No non-admin recipients found for target "${target}"`);
      return;
    }

    const sendPromises = actualRecipients.map(async (guest) => {
      try {
        let finalMessage = body;

        // Replace :firstName placeholders with actual first name
        const hasFirstNamePlaceholder = body.includes(":firstName");
        if (hasFirstNamePlaceholder && guest.firstName) {
          finalMessage = finalMessage.replace(/:firstName/g, guest.firstName);
        }

        // Add greeting prefix if :personalizedHi option is used
        if (enablePersonalizedHi && guest.firstName) {
          finalMessage = `Hi ${guest.firstName}! ${finalMessage}`;
        }

        // Determine log message based on personalization applied
        const personalizationApplied =
          (hasFirstNamePlaceholder && guest.firstName) || (enablePersonalizedHi && guest.firstName);
        if (personalizationApplied) {
          log(`Personalized message sent to ${guest.firstName} (${guest.phoneNumber})`);
        } else {
          log(`Non-personalized message sent to ${guest.firstName || "Guest"} (${guest.phoneNumber})`);
        }

        await twilioClient.messages.create({
          body: finalMessage,
          from: twilioPhoneNumber,
          to: guest.phoneNumber,
        });

        return { success: true, number: guest.phoneNumber, name: guest.firstName };
      } catch (error) {
        console.error(`Failed to send to ${guest.firstName || "Guest"} (${guest.phoneNumber}):`, error);
        return { success: false, number: guest.phoneNumber, name: guest.firstName, error: error.message };
      }
    });

    const results = await Promise.allSettled(sendPromises);
    const successful = results.filter((r) => r.status === "fulfilled" && r.value.success).length;
    const failed = results.length - successful;

    log(`Broadcast completed - ${successful} delivered, ${failed} failed for target "${target}"`);

    // Send notification to admins for @all broadcasts
    if (target.toLowerCase() === "all") {
      const notificationMessage = `📤 Message sent to @all, ${successful} recipients${
        failed > 0 ? ` (${failed} failed)` : ""
      }\n\nMessage: ${body}`;

      const adminNotificationPromises = admins.map(async (adminNumber) => {
        try {
          await twilioClient.messages.create({
            body: notificationMessage,
            from: twilioPhoneNumber,
            to: adminNumber,
          });
          log(`Notification sent to admin ${adminNumber}`);
        } catch (error) {
          console.error(`Failed to send notification to admin ${adminNumber}:`, error);
        }
      });

      await Promise.allSettled(adminNotificationPromises);
    }
  } catch (error) {
    console.error("Error handling admin message:", error);
  }
};

// Handle messages from non-admin users (guests)
const handleGuestMessage = async (twilioClient, message, sender, admins, twilioPhoneNumber) => {
  try {
    // Check if message is STOP request
    if (message && message.trim().toLowerCase() === "stop") {
      await handleStopRequest(twilioClient, sender, twilioPhoneNumber);
      return;
    }

    // Get guest data to find sender's name
    const guestData = await getGuestData();
    const senderGuest = guestData.find((guest) => guest.phoneNumber === sender);
    const senderName = senderGuest ? senderGuest.firstName : sender;

    // Forward message to all admins
    const forwardMessage = `📱 Message from ${senderName} (${sender}):\n\n${message}`;
    const forwardPromises = admins.map(async (adminNumber) => {
      try {
        await twilioClient.messages.create({
          body: forwardMessage,
          from: twilioPhoneNumber,
          to: adminNumber,
        });

        log(`Message forwarded to admin ${adminNumber}`);
      } catch (error) {
        console.error(`Failed to forward to admin ${adminNumber}:`, error);
      }
    });

    await Promise.allSettled(forwardPromises);
  } catch (error) {
    console.error("Error handling guest message:", error);
  }
};

// Handle STOP requests
const handleStopRequest = async (twilioClient, sender, twilioPhoneNumber) => {
  try {
    // Update shouldReceiveSms to FALSE in Google Sheets
    const success = await updateSmsPreference(sender, false);

    if (success) {
      await twilioClient.messages.create({
        body: "You have been unsubscribed from SMS messages.",
        from: twilioPhoneNumber,
        to: sender,
      });
      log(`Successfully unsubscribed ${sender} from SMS messages`);
    } else {
      console.error(`Failed to update SMS preference for ${sender}`);
    }
  } catch (error) {
    console.error("Error handling STOP request:", error);
  }
};

// Get target phone numbers based on alias
const getTargetNumbers = async (guestData, alias) => {
  const phoneNumbers = [];
  const filteredGuests = []; // Store guest objects for personalization

  switch (alias.toLowerCase()) {
    case "all": {
      const allGuests = guestData.filter(
        (guest) => guest.phoneNumber && (guest.shouldReceiveSMS === "TRUE" || guest.shouldReceiveSMS === true)
      );
      phoneNumbers.push(...allGuests.map((guest) => guest.phoneNumber));
      filteredGuests.push(...allGuests);
      break;
    }

    case "rsvped": {
      // Only guests who have RSVPed and accepted and want to receive SMS
      const rsvpedGuests = guestData.filter(
        (guest) =>
          guest.phoneNumber &&
          (guest.shouldReceiveSMS === "TRUE" || guest.shouldReceiveSMS === true) &&
          guest.rsvp &&
          guest.rsvp.toLowerCase().includes("accept")
      );
      phoneNumbers.push(...rsvpedGuests.map((guest) => guest.phoneNumber));
      filteredGuests.push(...rsvpedGuests);
      break;
    }

    case "notresponded": {
      // Guests who haven't responded yet and want to receive SMS
      const notRespondedGuests = guestData.filter(
        (guest) =>
          guest.phoneNumber &&
          (guest.shouldReceiveSMS === "TRUE" || guest.shouldReceiveSMS === true) &&
          (!guest.rsvp || guest.rsvp.trim() === "")
      );
      phoneNumbers.push(...notRespondedGuests.map((guest) => guest.phoneNumber));
      filteredGuests.push(...notRespondedGuests);
      break;
    }

    case "declined": {
      // Guests who declined and want to receive SMS
      const declinedGuests = guestData.filter(
        (guest) =>
          guest.phoneNumber &&
          (guest.shouldReceiveSMS === "TRUE" || guest.shouldReceiveSMS === true) &&
          guest.rsvp &&
          guest.rsvp.toLowerCase().includes("decline")
      );
      phoneNumbers.push(...declinedGuests.map((guest) => guest.phoneNumber));
      filteredGuests.push(...declinedGuests);
      break;
    }

    case "family1":
    case "family2":
    case "friends": {
      // Group-based targeting using Google Sheet columns (isFamily1, isFamily2, isFriends)
      const columnName = `is${alias.charAt(0).toUpperCase() + alias.slice(1)}`;
      const groupGuests = guestData.filter(
        (guest) =>
          guest.phoneNumber &&
          (guest.shouldReceiveSMS === "TRUE" || guest.shouldReceiveSMS === true) &&
          (guest[columnName] === "TRUE" || guest[columnName] === true)
      );
      phoneNumbers.push(...groupGuests.map((guest) => guest.phoneNumber));
      filteredGuests.push(...groupGuests);
      break;
    }

    default: {
      const partyGuests = guestData.filter(
        (guest) =>
          guest.party &&
          guest.party.toLowerCase() === alias.toLowerCase() &&
          guest.phoneNumber &&
          (guest.shouldReceiveSMS === "TRUE" || guest.shouldReceiveSMS === true)
      );

      if (partyGuests.length > 0) {
        phoneNumbers.push(...partyGuests.map((guest) => guest.phoneNumber));
        filteredGuests.push(...partyGuests);
      }
      break;
    }
  }

  return {
    phoneNumbers: [...new Set(phoneNumbers)].filter((num) => num && num.trim() !== ""),
    guests: filteredGuests,
  };
};

module.exports = { handler };

const { updateSmsPreference } = require("./googleSheets");
const { log } = require("./utils");

// Handle messages from non-admin users (guests)
const handleGuestMessage = async (twilioClient, message, sender, admins, twilioPhoneNumber, guestData) => {
  try {
    // Check if message is STOP request
    if (message && message.trim().toLowerCase() === "stop") {
      await handleStopRequest(twilioClient, sender, twilioPhoneNumber);
      return;
    }

    // Use provided guestData to find sender's name
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

module.exports = { handleGuestMessage, handleStopRequest };

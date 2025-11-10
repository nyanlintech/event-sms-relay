const { log } = require("./utils");
const { selectGuests } = require("./selectGuests");

// Handle messages from admin users
const handleAdminMessage = async (twilioClient, message, twilioPhoneNumber, admins, sender, guestData) => {
  try {
    // Parse message for aliases (@all, @family1, etc.) and phone numbers (@+15551234567)
    let aliasMatch;

    // Special handling for phone numbers starting with @+1
    if (message.startsWith("@+1")) {
      // Extract phone number until first space, then rest is message
      const phoneMatch = message.match(/^@(\+1\d{10})\s+(.+)/s);

      if (phoneMatch) {
        aliasMatch = phoneMatch;
      }
    }

    // Fallback to general pattern for other targets
    if (!aliasMatch) {
      aliasMatch = message.match(/^@(\S+)\s+(.+)/s);
    }

    if (!aliasMatch) {
      console.error("Admin message doesn't match valid format (@target message)");
      return;
    }

    const [, target, body] = aliasMatch;
    log(`Admin broadcast request - Target: ${target}, Message: ${body}`);

    // Find the sending admin's name
    const sendingAdmin = guestData.find((guest) => guest.phoneNumber === sender);
    const adminName = sendingAdmin?.firstName || "Admin";

    // Get target phone numbers and guest objects based on alias
    const guests = await selectGuests(guestData, target);
    const phoneNumbers = guests.map((g) => g.phoneNumber).filter(Boolean);

    if (phoneNumbers.length === 0) {
      console.error(`No recipients found for target "${target}"`);
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

    // Send messages to all targets (excluding admins for @all)
    const sendPromises = actualRecipients.map(async (guest) => {
      try {
        await twilioClient.messages.create({
          body: body,
          from: twilioPhoneNumber,
          to: guest.phoneNumber,
        });
        log(`Message sent to ${guest.firstName || "Guest"} (${guest.phoneNumber})`);
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

    // Send notification to all admins for ALL broadcasts (not just @all)
    const truncatedBody = body.length > 50 ? `${body.substring(0, 50)}...` : body;
    const notificationMessage = `📤 ${adminName} → @${target} (${successful}${
      failed > 0 ? `, ${failed} failed` : ""
    })\n"${truncatedBody}"`;

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
  } catch (error) {
    console.error("Error handling admin message:", error);
  }
};

module.exports = { handleAdminMessage };

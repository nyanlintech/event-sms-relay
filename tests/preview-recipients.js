/**
 * Live Data Preview - WHO WOULD RECEIVE MESSAGES
 *
 * This script shows you exactly who would receive messages for different
 * targeting commands using your REAL Google Sheets data, but WITHOUT
 * sending any actual SMS messages.
 *
 * Usage: node tests/preview-recipients.js
 */

const { getGuestData } = require("../src/googleSheets");

// MOCK Twilio client - NO REAL SMS MESSAGES SENT
const previewTwilioClient = {
  messages: {
    recipients: [],
    create: async function (messageData) {
      // Store recipient info instead of sending
      this.recipients.push({
        to: messageData.to,
        body: messageData.body,
        timestamp: new Date(),
      });

      // Just log what WOULD be sent (but isn't)
      console.log(`📋 WOULD SEND to ${messageData.to}: ${messageData.body}`);
      return { sid: `preview_${Date.now()}` };
    },
  },
};

const mockAdminNumbers = ["+15551111111"]; // Fake admin for testing
const mockTwilioNumber = "+15550000000";

// Get target phone numbers based on alias (copied from handler.js)
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

// Simplified handleAdminMessage for preview (no real SMS sending)
const handleAdminMessage = async (twilioClient, message, twilioPhoneNumber, admins) => {
  try {
    const aliasMatch = message.match(/^@(\w+)(?::(\w+))?\s+(.+)/s);

    if (!aliasMatch) {
      console.log("❌ Invalid format. Use: @target message");
      return;
    }

    const [, target, option, body] = aliasMatch;

    // Get guest data from Google Sheets
    const guestData = await getGuestData();

    // Get target phone numbers and guest objects based on alias
    const { guests } = await getTargetNumbers(guestData, target);

    if (guests.length === 0) {
      console.log(`❌ No recipients found for target "${target}"`);
      return;
    }

    // Filter out admins from recipients for "@all" target
    let actualRecipients = guests;
    if (target.toLowerCase() === "all") {
      actualRecipients = guests.filter((guest) => !admins.includes(guest.phoneNumber));
    }

    if (actualRecipients.length === 0) {
      console.log(`❌ No non-admin recipients found for target "${target}"`);
      return;
    }

    // Process each recipient
    actualRecipients.forEach(async (guest) => {
      try {
        let finalMessage = body;

        // Replace :firstName placeholders with actual first name
        const hasFirstNamePlaceholder = body.includes(":firstName");
        if (hasFirstNamePlaceholder && guest.firstName) {
          finalMessage = finalMessage.replace(/:firstName/g, guest.firstName);
        }

        // Use the mock Twilio client to "send" (actually just log)
        await twilioClient.messages.create({
          body: finalMessage,
          from: twilioPhoneNumber,
          to: guest.phoneNumber,
        });
      } catch (error) {
        console.error(`❌ Failed to preview message for ${guest.firstName || "Guest"} (${guest.phoneNumber}):`, error);
      }
    });
  } catch (error) {
    console.error("❌ Error in preview:", error);
  }
};

// Preview function for different targets
const previewTarget = async (targetCommand) => {
  console.log(`\n🎯 PREVIEW: ${targetCommand}`);
  console.log("=".repeat(50));

  try {
    // Get real guest data from Google Sheets
    const guestData = await getGuestData();
    console.log(`📊 Total guests in sheet: ${guestData.length}`);

    // Extract just the target (remove @ symbol)
    const target = targetCommand.replace("@", "");

    // Get who would receive messages for this target
    const { guests } = await getTargetNumbers(guestData, target);

    console.log(`🎯 Target: ${target}`);
    console.log(`📱 Would send to ${guests.length} recipients:`);

    if (guests.length === 0) {
      console.log("   No recipients found for this target.");
      return;
    }

    // Show who would receive messages
    guests.forEach((guest, index) => {
      const name = guest.firstName || "No name";
      const phone = guest.phoneNumber;
      const rsvp = guest.rsvp || "No response";
      const groups = [];

      if (guest.isFamily1 === "TRUE") groups.push("Family1");
      if (guest.isFamily2 === "TRUE") groups.push("Family2");
      if (guest.isFriends === "TRUE") groups.push("Friends");
      if (guest.isAdmin === "TRUE") groups.push("ADMIN");

      console.log(`   ${index + 1}. ${name} (${phone})`);
      console.log(`      RSVP: ${rsvp}`);
      console.log(`      Groups: ${groups.length > 0 ? groups.join(", ") : "None"}`);
      console.log(`      Party: ${guest.party || "None"}`);
      console.log("");
    });

    // Filter out admins for @all (like the real system does)
    if (target.toLowerCase() === "all") {
      const nonAdminGuests = guests.filter((guest) => guest.isAdmin !== "TRUE");
      console.log(`📝 Note: @all excludes admins, so ${nonAdminGuests.length} would actually receive messages`);
    }
  } catch (error) {
    console.error(`❌ Error previewing ${targetCommand}:`, error.message);
  }
};

// Preview what personalization would look like
const previewPersonalization = async (command, message) => {
  console.log(`\n💬 PERSONALIZATION PREVIEW: ${command} ${message}`);
  console.log("=".repeat(60));

  try {
    // Clear previous recipients
    previewTwilioClient.messages.recipients = [];

    // Use the real handleAdminMessage function with our mock Twilio client
    const fullMessage = `${command} ${message}`;
    await handleAdminMessage(previewTwilioClient, fullMessage, mockTwilioNumber, mockAdminNumbers);

    const recipients = previewTwilioClient.messages.recipients;

    if (recipients.length === 0) {
      console.log("❌ No messages would be sent (check your target)");
      return;
    }

    console.log(`📨 ${recipients.length} messages would be sent:`);
    console.log("");

    recipients.forEach((recipient, index) => {
      console.log(`${index + 1}. To: ${recipient.to}`);
      console.log(`   Message: "${recipient.body}"`);
      console.log("");
    });
  } catch (error) {
    console.error(`❌ Error previewing personalization:`, error.message);
  }
};

// Preview specific groups
const previewGroups = async () => {
  console.log("🏷️  GROUP BREAKDOWN");
  console.log("=".repeat(40));

  try {
    const guestData = await getGuestData();

    const groups = {
      "All Guests": guestData.filter((g) => g.shouldReceiveSMS === "TRUE"),
      Admins: guestData.filter((g) => g.isAdmin === "TRUE"),
      Family1: guestData.filter((g) => g.isFamily1 === "TRUE"),
      Family2: guestData.filter((g) => g.isFamily2 === "TRUE"),
      Friends: guestData.filter((g) => g.isFriends === "TRUE"),
      "RSVP Accepted": guestData.filter((g) => g.rsvp && g.rsvp.toLowerCase().includes("accept")),
      "RSVP Declined": guestData.filter((g) => g.rsvp && g.rsvp.toLowerCase().includes("decline")),
      "No RSVP Response": guestData.filter((g) => !g.rsvp || g.rsvp.trim() === ""),
      "SMS Disabled": guestData.filter((g) => g.shouldReceiveSMS !== "TRUE"),
    };

    Object.entries(groups).forEach(([groupName, members]) => {
      console.log(`\n${groupName}: ${members.length} people`);
      if (members.length > 0 && members.length <= 20) {
        members.forEach((member) => {
          console.log(`  • ${member.firstName || "No name"} (${member.phoneNumber || "No phone"})`);
        });
      } else if (members.length > 20) {
        console.log(`  (Too many to list - use specific target preview)`);
      }
    });
  } catch (error) {
    console.error(`❌ Error getting group breakdown:`, error.message);
  }
};

// Interactive preview mode
const runInteractivePreview = async () => {
  console.log("🔍 LIVE RECIPIENT PREVIEW");
  console.log("========================");
  console.log("🚫 NO SMS MESSAGES WILL BE SENT - PREVIEW ONLY");
  console.log("");

  // Enable debug logging to see what's happening
  process.env.DEBUG = "true";

  // Quick group overview
  await previewGroups();

  // Preview common targets
  const commonTargets = ["@all", "@rsvped", "@notresponded", "@declined", "@family1", "@family2", "@friends"];

  for (const target of commonTargets) {
    await previewTarget(target);
  }

  console.log("\n💬 PERSONALIZATION EXAMPLES");
  console.log("============================");

  // Preview personalization examples
  await previewPersonalization("@friends", "Hi :firstName! Party starts at 8pm!");
  await previewPersonalization("@family1", "Hey :firstName, family dinner tonight!");
  await previewPersonalization("@rsvped", "Thanks :firstName for RSVPing!");
  await previewPersonalization("@all", "Important announcement for everyone."); // No personalization

  console.log("\n🎉 PREVIEW COMPLETE!");
  console.log("✅ You can now see exactly who would receive each type of message");
  console.log("✅ No real SMS messages were sent during this preview");

  process.env.DEBUG = "false";
};

// Command line interface
const runCommand = async () => {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log("Usage examples:");
    console.log("  node tests/preview-recipients.js                    # Full preview");
    console.log("  node tests/preview-recipients.js @friends           # Preview @friends target");
    console.log("  node tests/preview-recipients.js @all 'Hi :firstName!'  # Preview with message");
    console.log("");
    await runInteractivePreview();
    return;
  }

  const target = args[0];
  const message = args[1];

  if (message) {
    await previewPersonalization(target, message);
  } else {
    await previewTarget(target);
  }
};

// Export for use in other files
module.exports = {
  previewTarget,
  previewPersonalization,
  previewGroups,
  runInteractivePreview,
};

// Run if executed directly
if (require.main === module) {
  runCommand().catch(console.error);
}

// Test file for the message parser functionality with actual Google Sheets integration
// This will parse messages AND show who would receive them from your actual Google Sheet

const { getGuestData } = require("../src/googleSheets");

// Simple test function that mimics the parsing logic in handler.js
const testAdminMessage = (message) => {
  const aliasMatch = message.match(/^@(\w+)\s+(.+)/s);

  if (aliasMatch) {
    const [, target, body] = aliasMatch;
    return {
      target: target,
      body: body.trim(),
      isValid: true,
    };
  }

  return {
    isValid: false,
  };
};

// Function to get target phone numbers (copied from handler.js)
const getTargetNumbers = async (guestData, alias) => {
  const phoneNumbers = [];
  const recipients = []; // Store recipient details for logging

  switch (alias.toLowerCase()) {
    case "all": {
      const allGuests = guestData.filter(
        (guest) => guest.phoneNumber && (guest.shouldReceiveSMS === "TRUE" || guest.shouldReceiveSMS === true)
      );
      phoneNumbers.push(...allGuests.map((guest) => guest.phoneNumber));
      recipients.push(
        ...allGuests.map((guest) => ({
          name: guest.firstName || "Unknown",
          phone: guest.phoneNumber,
          reason: "opted in for SMS",
        }))
      );
      break;
    }

    case "rsvped": {
      const rsvpedGuests = guestData.filter(
        (guest) =>
          guest.phoneNumber &&
          (guest.shouldReceiveSMS === "TRUE" || guest.shouldReceiveSMS === true) &&
          guest.rsvp &&
          guest.rsvp.toLowerCase().includes("accept")
      );
      phoneNumbers.push(...rsvpedGuests.map((guest) => guest.phoneNumber));
      recipients.push(
        ...rsvpedGuests.map((guest) => ({
          name: guest.firstName || "Unknown",
          phone: guest.phoneNumber,
          reason: "RSVPed yes",
        }))
      );
      break;
    }

    case "notresponded": {
      const notRespondedGuests = guestData.filter(
        (guest) =>
          guest.phoneNumber &&
          (guest.shouldReceiveSMS === "TRUE" || guest.shouldReceiveSMS === true) &&
          (!guest.rsvp || guest.rsvp.trim() === "")
      );
      phoneNumbers.push(...notRespondedGuests.map((guest) => guest.phoneNumber));
      recipients.push(
        ...notRespondedGuests.map((guest) => ({
          name: guest.firstName || "Unknown",
          phone: guest.phoneNumber,
          reason: "has not responded yet",
        }))
      );
      break;
    }

    case "declined": {
      const declinedGuests = guestData.filter(
        (guest) =>
          guest.phoneNumber &&
          (guest.shouldReceiveSMS === "TRUE" || guest.shouldReceiveSMS === true) &&
          guest.rsvp &&
          guest.rsvp.toLowerCase().includes("decline")
      );
      phoneNumbers.push(...declinedGuests.map((guest) => guest.phoneNumber));
      recipients.push(
        ...declinedGuests.map((guest) => ({
          name: guest.firstName || "Unknown",
          phone: guest.phoneNumber,
          reason: "declined invitation",
        }))
      );
      break;
    }

    case "family1":
    case "family2":
    case "friends": {
      const columnName = `is${alias.charAt(0).toUpperCase() + alias.slice(1)}`;
      const groupGuests = guestData.filter(
        (guest) =>
          guest.phoneNumber &&
          (guest.shouldReceiveSMS === "TRUE" || guest.shouldReceiveSMS === true) &&
          (guest[columnName] === "TRUE" || guest[columnName] === true)
      );
      phoneNumbers.push(...groupGuests.map((guest) => guest.phoneNumber));
      recipients.push(
        ...groupGuests.map((guest) => ({
          name: guest.firstName || "Unknown",
          phone: guest.phoneNumber,
          reason: `member of ${alias} group`,
        }))
      );
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
      phoneNumbers.push(...partyGuests.map((guest) => guest.phoneNumber));
      recipients.push(
        ...partyGuests.map((guest) => ({
          name: guest.firstName || "Unknown",
          phone: guest.phoneNumber,
          reason: `member of party "${alias}"`,
        }))
      );
      break;
    }
  }

  return {
    phoneNumbers: [...new Set(phoneNumbers)].filter((num) => num && num.trim() !== ""),
    recipients: recipients,
  };
};

// Test cases for actual workflow testing
const testMessages = [
  "@friends hello there!",
  "@family1 don't forget dessert",
  "@all important announcement",
  "@rsvped see you tomorrow",
  "@notresponded please respond soon",
];

async function runWorkflowTests() {
  console.log("🧪 Testing Message Parser with Google Sheets Integration");
  console.log("=" * 60);

  try {
    // Fetch actual guest data from Google Sheets
    console.log("📊 Fetching guest data from Google Sheets...");
    const guestData = await getGuestData();
    console.log(`✅ Loaded ${guestData.length} guests from Google Sheets\n`);

    // Test each message
    for (let i = 0; i < testMessages.length; i++) {
      const message = testMessages[i];
      console.log(`📱 Test ${i + 1}: "${message}"`);
      console.log("-".repeat(50));

      // Parse the message
      const parsed = testAdminMessage(message);

      if (!parsed.isValid) {
        console.log("❌ Invalid message format\n");
        continue;
      }

      console.log(`✅ Parsed: Target="${parsed.target}", Body="${parsed.body}"`);

      // Get recipients from Google Sheets
      const { phoneNumbers, recipients } = await getTargetNumbers(guestData, parsed.target);

      console.log(`📧 Would send to ${phoneNumbers.length} recipients:`);

      if (recipients.length === 0) {
        console.log("   (No recipients found for this target)");
      } else {
        recipients.forEach((recipient, index) => {
          console.log(`   ${index + 1}. ${recipient.name} (${recipient.phone}) - ${recipient.reason}`);
        });
      }

      console.log(`📱 Phone numbers: ${phoneNumbers.join(", ")}`);
      console.log(""); // Empty line for spacing
    }

    // Show summary of all groups
    console.log("📊 Summary of all available targets:");
    console.log("-".repeat(50));

    const allTargets = ["all", "rsvped", "notresponded", "declined", "family1", "family2", "friends"];

    for (const target of allTargets) {
      const { phoneNumbers } = await getTargetNumbers(guestData, target);
      console.log(`${target.padEnd(12)}: ${phoneNumbers.length} recipients`);
    }
  } catch (error) {
    console.error("❌ Error during testing:", error.message);
    console.error("💡 Make sure your Google Sheets credentials are set up correctly in SSM");
  }
}

console.log("🎯 Choose test mode:");
console.log("1. Full workflow test (connects to Google Sheets)");
console.log("2. Simple parsing test only");
console.log("");

// Check if we should run full workflow or simple parsing
const args = process.argv.slice(2);
if (args.includes("--simple")) {
  // Simple parsing test
  console.log("Testing Message Parser (Simple Mode)\n" + "=".repeat(50));

  const simpleTestMessages = [
    "@all Hello everyone!",
    "@friends Party time!",
    "invalid message",
    "@family1 Don't forget dessert",
  ];

  simpleTestMessages.forEach((message, index) => {
    console.log(`\nTest ${index + 1}: "${message}"`);
    const result = testAdminMessage(message);

    if (result.isValid) {
      console.log(`✅ Parsed successfully:`);
      console.log(`   Target: "${result.target}"`);
      console.log(`   Body: "${result.body}"`);
    } else {
      console.log(`❌ Invalid format`);
    }
  });
} else {
  // Full workflow test
  runWorkflowTests().catch(console.error);
}

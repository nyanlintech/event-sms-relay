// Local test script for the SMS relay functionality
// This will test the message parsing and simulate sending without actually sending SMS

const { handler } = require("../src/handler");

// Mock Twilio event data (simulates what Twilio sends to your webhook)
const createMockEvent = (fromNumber, messageBody) => ({
  body: `From=${encodeURIComponent(fromNumber)}&Body=${encodeURIComponent(messageBody)}`,
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
  },
});

// Test cases
const testCases = [
  {
    name: "Admin sends message to all",
    from: "+1234567890", // This should be an admin number in your sheet
    message: "@all Hello everyone! This is a test message.",
  },
  {
    name: "Admin sends message to family1",
    from: "+1234567890",
    message: "@family1 Special message for family1 group.",
  },
  {
    name: "Admin sends message to friends",
    from: "+1234567890",
    message: "@friends Hey friends! Party time!",
  },
  {
    name: "Admin sends message to RSVPed guests",
    from: "+1234567890",
    message: "@rsvped Don't forget to bring your RSVP cards tomorrow!",
  },
  {
    name: "Guest sends message (should forward to admins)",
    from: "+9876543210", // This should be a non-admin number
    message: "Hi, I have a question about the event.",
  },
  {
    name: "Invalid admin format (should be ignored)",
    from: "+1234567890",
    message: "Just a regular message without @ format",
  },
];

async function runTests() {
  console.log("🧪 Testing Event SMS Relay Locally");
  console.log("=" * 50);

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`\n📱 Test ${i + 1}: ${testCase.name}`);
    console.log(`From: ${testCase.from}`);
    console.log(`Message: "${testCase.message}"`);
    console.log("-".repeat(40));

    try {
      const mockEvent = createMockEvent(testCase.from, testCase.message);
      const result = await handler(mockEvent);

      console.log(`✅ Handler completed successfully`);
      console.log(`Status Code: ${result.statusCode}`);
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
      console.log(`Stack: ${error.stack}`);
    }

    console.log(""); // Empty line for spacing
  }

  console.log("🎉 Local testing completed!");
  console.log("\n💡 Notes:");
  console.log("- Messages won't actually be sent in local testing mode");
  console.log("- Check the console output above to see how messages would be processed");
  console.log("- Make sure your admin phone numbers match those in your Google Sheet");
  console.log("- Update test phone numbers above to match your actual data");
}

// Run the tests
runTests().catch(console.error);

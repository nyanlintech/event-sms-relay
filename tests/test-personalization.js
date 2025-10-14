/**
 * Test Personalization Features
 *
 * This test file verifies that the new :firstName personalization
 * system works correctly with different message formats and targeting options.
 *
 * Run with: node tests/test-personalization.js
 */

const { handleAdminMessage, getTargetNumbers } = require("../src/handlerUtils");

// Mock guest data (simulates Google Sheets data)
const mockGuestData = [
  {
    firstName: "John",
    lastName: "Smith",
    phoneNumber: "+15551234567",
    shouldReceiveSMS: "TRUE",
    isAdmin: "FALSE",
    rsvp: "Joyfully Accept",
    isFamily1: "TRUE",
    isFamily2: "FALSE",
    isFriends: "FALSE",
    party: "smith-family",
  },
  {
    firstName: "Sarah",
    lastName: "Johnson",
    phoneNumber: "+15559876543",
    shouldReceiveSMS: "TRUE",
    isAdmin: "FALSE",
    rsvp: "Joyfully Accept",
    isFamily1: "FALSE",
    isFamily2: "TRUE",
    isFriends: "FALSE",
    party: "johnson-party",
  },
  {
    firstName: "Mike",
    lastName: "Wilson",
    phoneNumber: "+15555555555",
    shouldReceiveSMS: "TRUE",
    isAdmin: "FALSE",
    rsvp: "",
    isFamily1: "FALSE",
    isFamily2: "FALSE",
    isFriends: "TRUE",
    party: "wilson-crew",
  },
  {
    firstName: "Admin",
    lastName: "User",
    phoneNumber: "+15551111111",
    shouldReceiveSMS: "TRUE",
    isAdmin: "TRUE",
    rsvp: "Joyfully Accept",
    isFamily1: "FALSE",
    isFamily2: "FALSE",
    isFriends: "FALSE",
    party: "admin",
  },
  {
    firstName: "", // Guest with no first name
    lastName: "NoName",
    phoneNumber: "+15552222222",
    shouldReceiveSMS: "TRUE",
    isAdmin: "FALSE",
    rsvp: "Joyfully Accept",
    isFamily1: "FALSE",
    isFamily2: "FALSE",
    isFriends: "FALSE",
    party: "mystery",
  },
];

// Mock Twilio client that captures messages instead of sending them
const mockTwilioClient = {
  messages: {
    sentMessages: [], // Store sent messages for verification
    create: async function (messageData) {
      this.sentMessages.push({
        to: messageData.to,
        from: messageData.from,
        body: messageData.body,
        timestamp: new Date(),
      });
      console.log(`📤 MOCK SMS to ${messageData.to}: ${messageData.body}`);
      return { sid: `mock_${Date.now()}` };
    },
  },
};

// Mock getGuestData function by temporarily overriding the module
const mockGoogleSheets = {
  getGuestData: async () => mockGuestData,
  updateSmsPreference: async (phoneNumber, shouldReceive) => {
    console.log(`📝 MOCK: Updated SMS preference for ${phoneNumber} to ${shouldReceive}`);
    return true;
  },
};

// Override the googleSheets module temporarily for testing
require.cache[require.resolve("../src/googleSheets")] = {
  exports: mockGoogleSheets,
};

const twilioPhoneNumber = "+15550000000";
const adminPhoneNumbers = ["+15551111111"];

// Test utilities
const assert = (condition, message) => {
  if (!condition) {
    throw new Error(`❌ ASSERTION FAILED: ${message}`);
  }
  console.log(`✅ ${message}`);
};

const clearMessages = () => {
  mockTwilioClient.messages.sentMessages = [];
};

const getMessageFor = (phoneNumber) => {
  return mockTwilioClient.messages.sentMessages.find((msg) => msg.to === phoneNumber);
};

// Test functions
const testTargetSelection = async () => {
  console.log("\n🎯 Testing Target Selection");

  // Test @all targeting
  const allResult = await getTargetNumbers(mockGuestData, "all");
  assert(allResult.guests.length === 5, "@all should return 5 guests"); // All guests including admin
  assert(allResult.phoneNumbers.includes("+15551234567"), "@all should include John");
  assert(allResult.phoneNumbers.includes("+15559876543"), "@all should include Sarah");

  // Test @rsvped targeting
  const rsvpedResult = await getTargetNumbers(mockGuestData, "rsvped");
  console.log(
    `Debug: @rsvped returned ${rsvpedResult.guests.length} guests:`,
    rsvpedResult.guests.map((g) => g.firstName)
  );
  assert(rsvpedResult.guests.length === 4, "@rsvped should return 4 guests"); // John, Sarah, NoName, Admin all accepted
  assert(rsvpedResult.phoneNumbers.includes("+15551234567"), "@rsvped should include John");
  assert(!rsvpedResult.phoneNumbers.includes("+15555555555"), "@rsvped should not include Mike");

  // Test @family1 targeting
  const family1Result = await getTargetNumbers(mockGuestData, "family1");
  assert(family1Result.guests.length === 1, "@family1 should return 1 guest");
  assert(family1Result.phoneNumbers.includes("+15551234567"), "@family1 should include John");

  console.log("✅ All target selection tests passed!");
};

const testBasicPersonalization = async () => {
  console.log("\n👋 Testing Basic Personalization");
  clearMessages();

  const message = "@all Hi :firstName! Hope you're doing well.";
  await handleAdminMessage(mockTwilioClient, message, twilioPhoneNumber, adminPhoneNumbers);

  // Should send to 4 guests (excluding admin from @all)
  assert(mockTwilioClient.messages.sentMessages.length === 4, "Should send 4 messages for @all (excluding admin)");

  // Check personalized messages
  const johnMessage = getMessageFor("+15551234567");
  assert(
    johnMessage && johnMessage.body === "Hi John! Hope you're doing well.",
    "John should get personalized message"
  );

  const sarahMessage = getMessageFor("+15559876543");
  assert(
    sarahMessage && sarahMessage.body === "Hi Sarah! Hope you're doing well.",
    "Sarah should get personalized message"
  );

  const mikeMessage = getMessageFor("+15555555555");
  assert(
    mikeMessage && mikeMessage.body === "Hi Mike! Hope you're doing well.",
    "Mike should get personalized message"
  );

  // Guest with no first name should get :firstName unchanged
  const noNameMessage = getMessageFor("+15552222222");
  assert(
    noNameMessage && noNameMessage.body === "Hi :firstName! Hope you're doing well.",
    "Guest with no name should get :firstName unchanged"
  );

  console.log("✅ Basic personalization tests passed!");
};

const testMultiplePersonalization = async () => {
  console.log("\n🔄 Testing Multiple :firstName Placeholders");
  clearMessages();

  const message = "@rsvped Thanks :firstName! :firstName, don't forget the date.";
  await handleAdminMessage(mockTwilioClient, message, twilioPhoneNumber, adminPhoneNumbers);

  const johnMessage = getMessageFor("+15551234567");
  assert(
    johnMessage && johnMessage.body === "Thanks John! John, don't forget the date.",
    "Multiple :firstName should be replaced for John"
  );

  const sarahMessage = getMessageFor("+15559876543");
  assert(
    sarahMessage && sarahMessage.body === "Thanks Sarah! Sarah, don't forget the date.",
    "Multiple :firstName should be replaced for Sarah"
  );

  console.log("✅ Multiple personalization tests passed!");
};

const testNoPersonalization = async () => {
  console.log("\n📢 Testing No Personalization");
  clearMessages();

  const message = "@all Important announcement for everyone.";
  await handleAdminMessage(mockTwilioClient, message, twilioPhoneNumber, adminPhoneNumbers);

  assert(mockTwilioClient.messages.sentMessages.length === 4, "Should send 4 messages");

  // All messages should be identical
  mockTwilioClient.messages.sentMessages.forEach((msg) => {
    assert(
      msg.body === "Important announcement for everyone.",
      "All messages should be identical without personalization"
    );
  });

  console.log("✅ No personalization tests passed!");
};

const testGroupTargeting = async () => {
  console.log("\n👨‍👩‍👧‍👦 Testing Group Targeting with Personalization");
  clearMessages();

  // Test family1 group
  const familyMessage = "@family1 Hi :firstName! Family dinner is at 6pm.";
  await handleAdminMessage(mockTwilioClient, familyMessage, twilioPhoneNumber, adminPhoneNumbers);

  assert(mockTwilioClient.messages.sentMessages.length === 1, "Should send 1 message to family1");

  const johnMessage = getMessageFor("+15551234567");
  assert(johnMessage && johnMessage.body === "Hi John! Family dinner is at 6pm.", "John should get family1 message");

  clearMessages();

  // Test friends group
  const friendsMessage = "@friends Hey :firstName! Party starts at 8pm!";
  await handleAdminMessage(mockTwilioClient, friendsMessage, twilioPhoneNumber, adminPhoneNumbers);

  assert(mockTwilioClient.messages.sentMessages.length === 1, "Should send 1 message to friends");

  const mikeMessage = getMessageFor("+15555555555");
  assert(mikeMessage && mikeMessage.body === "Hey Mike! Party starts at 8pm!", "Mike should get friends message");

  console.log("✅ Group targeting tests passed!");
};

const testEdgeCases = async () => {
  console.log("\n⚠️  Testing Edge Cases");
  clearMessages();

  // Test invalid target
  const invalidMessage = "@invalidtarget Hello everyone!";
  await handleAdminMessage(mockTwilioClient, invalidMessage, twilioPhoneNumber, adminPhoneNumbers);

  assert(mockTwilioClient.messages.sentMessages.length === 0, "Invalid target should send 0 messages");

  clearMessages();

  // Test malformed message
  const malformedMessage = "Hello everyone!"; // Missing @ target
  await handleAdminMessage(mockTwilioClient, malformedMessage, twilioPhoneNumber, adminPhoneNumbers);

  assert(mockTwilioClient.messages.sentMessages.length === 0, "Malformed message should send 0 messages");

  console.log("✅ Edge case tests passed!");
};

const testRealWorldScenarios = async () => {
  console.log("\n🌍 Testing Real-world Scenarios");
  clearMessages();

  // Wedding reminder
  const weddingMessage = "@rsvped Hi :firstName! Don't forget the wedding is tomorrow at 3pm. Can't wait to see you!";
  await handleAdminMessage(mockTwilioClient, weddingMessage, twilioPhoneNumber, adminPhoneNumbers);

  assert(mockTwilioClient.messages.sentMessages.length === 3, "Wedding reminder should go to 3 RSVP'd guests"); // John, Sarah, NoName

  const johnMessage = getMessageFor("+15551234567");
  assert(johnMessage && johnMessage.body.includes("Hi John!"), "John should get personalized wedding reminder");

  clearMessages();

  // RSVP reminder (no personalization)
  const rsvpMessage = "@notresponded Please remember to RSVP by Friday. Thank you!";
  await handleAdminMessage(mockTwilioClient, rsvpMessage, twilioPhoneNumber, adminPhoneNumbers);

  assert(mockTwilioClient.messages.sentMessages.length === 1, "RSVP reminder should go to 1 guest"); // Only Mike

  const mikeMessage = getMessageFor("+15555555555");
  assert(
    mikeMessage && mikeMessage.body === "Please remember to RSVP by Friday. Thank you!",
    "Mike should get RSVP reminder"
  );

  console.log("✅ Real-world scenario tests passed!");
};

// Main test runner
const runAllTests = async () => {
  console.log("🧪 Starting Personalization Feature Tests");
  console.log("==========================================");

  // Enable debug logging
  process.env.DEBUG = "true";

  try {
    await testTargetSelection();
    await testBasicPersonalization();
    await testMultiplePersonalization();
    await testNoPersonalization();
    await testGroupTargeting();
    await testEdgeCases();
    await testRealWorldScenarios();

    console.log("\n🎉 ALL TESTS PASSED! 🎉");
    console.log("The personalization system is working correctly!");
  } catch (error) {
    console.error("\n💥 TEST FAILED:", error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    process.env.DEBUG = "false";
  }
};

// Export for use in other files
module.exports = {
  mockGuestData,
  mockTwilioClient,
  runAllTests,
  testTargetSelection,
  testBasicPersonalization,
};

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests();
}

const { handleGuestMessage, handleStopRequest } = require("../src/guestMessageHandler");
const { updateSmsPreference } = require("../src/googleSheets");

// Mock dependencies
jest.mock("../src/googleSheets");
jest.mock("../src/utils", () => ({
  log: jest.fn(),
}));

describe("Guest Message Handler", () => {
  let mockTwilioClient;
  let mockGuestData;
  let mockAdmins;
  let twilioPhoneNumber;
  let consoleErrorSpy;

  beforeEach(() => {
    // Mock console.error to suppress error logs in tests
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

    // Mock Twilio client
    mockTwilioClient = {
      messages: {
        create: jest.fn().mockResolvedValue({ sid: "mock-sid" }),
      },
    };

    // Mock guest data
    mockGuestData = [
      {
        firstName: "John",
        lastName: "Doe",
        phoneNumber: "+15551234567",
        shouldReceiveSMS: "TRUE",
        isAdmin: "FALSE",
      },
      {
        firstName: "Jane",
        lastName: "Smith",
        phoneNumber: "+15551234568",
        shouldReceiveSMS: "TRUE",
        isAdmin: "FALSE",
      },
      {
        firstName: "Admin",
        lastName: "User",
        phoneNumber: "+15551234569",
        shouldReceiveSMS: "TRUE",
        isAdmin: "TRUE",
      },
    ];

    mockAdmins = ["+15551234569", "+15551234570"];
    twilioPhoneNumber = "+15559999999";

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore console.error
    consoleErrorSpy.mockRestore();
  });

  describe("Guest Message Forwarding", () => {
    test("should forward guest message to all admins", async () => {
      const sender = "+15551234567"; // John
      const message = "Hello, I have a question about the event";

      await handleGuestMessage(mockTwilioClient, message, sender, mockAdmins, twilioPhoneNumber, mockGuestData);

      // Should send to both admins
      expect(mockTwilioClient.messages.create).toHaveBeenCalledTimes(2);

      expect(mockTwilioClient.messages.create).toHaveBeenCalledWith({
        body: `📱 Message from John (+15551234567):\n\n${message}`,
        from: twilioPhoneNumber,
        to: "+15551234569",
      });

      expect(mockTwilioClient.messages.create).toHaveBeenCalledWith({
        body: `📱 Message from John (+15551234567):\n\n${message}`,
        from: twilioPhoneNumber,
        to: "+15551234570",
      });
    });

    test("should include guest first name in forwarded message", async () => {
      const sender = "+15551234568"; // Jane
      const message = "Can I bring a plus one?";

      await handleGuestMessage(mockTwilioClient, message, sender, mockAdmins, twilioPhoneNumber, mockGuestData);

      const firstCall = mockTwilioClient.messages.create.mock.calls[0][0];
      expect(firstCall.body).toContain("Jane");
      expect(firstCall.body).toContain("+15551234568");
      expect(firstCall.body).toContain("Can I bring a plus one?");
    });

    test("should use phone number as fallback if guest not found in data", async () => {
      const unknownSender = "+15559999998";
      const message = "Who is this?";

      await handleGuestMessage(mockTwilioClient, message, unknownSender, mockAdmins, twilioPhoneNumber, mockGuestData);

      const firstCall = mockTwilioClient.messages.create.mock.calls[0][0];
      expect(firstCall.body).toContain(`📱 Message from ${unknownSender}`);
      expect(firstCall.body).toContain("Who is this?");
    });

    test("should handle multi-line messages", async () => {
      const sender = "+15551234567";
      const message = "Line 1\nLine 2\nLine 3";

      await handleGuestMessage(mockTwilioClient, message, sender, mockAdmins, twilioPhoneNumber, mockGuestData);

      const firstCall = mockTwilioClient.messages.create.mock.calls[0][0];
      expect(firstCall.body).toContain("Line 1\nLine 2\nLine 3");
    });

    test("should handle messages with emoji", async () => {
      const sender = "+15551234567";
      const message = "So excited! 🎉🎊";

      await handleGuestMessage(mockTwilioClient, message, sender, mockAdmins, twilioPhoneNumber, mockGuestData);

      const firstCall = mockTwilioClient.messages.create.mock.calls[0][0];
      expect(firstCall.body).toContain("So excited! 🎉🎊");
    });

    test("should handle empty message", async () => {
      const sender = "+15551234567";
      const message = "";

      await handleGuestMessage(mockTwilioClient, message, sender, mockAdmins, twilioPhoneNumber, mockGuestData);

      // Should still forward to admins
      expect(mockTwilioClient.messages.create).toHaveBeenCalledTimes(2);
    });

    test("should forward to all admins even if one is also a guest", async () => {
      const sender = "+15551234567";
      const message = "Test message";

      await handleGuestMessage(mockTwilioClient, message, sender, mockAdmins, twilioPhoneNumber, mockGuestData);

      // Should send to both admin numbers
      const adminCalls = mockTwilioClient.messages.create.mock.calls.map((call) => call[0].to);

      expect(adminCalls).toContain("+15551234569");
      expect(adminCalls).toContain("+15551234570");
    });
  });

  describe("Message Format", () => {
    test("should include 📱 emoji in forwarded message", async () => {
      const sender = "+15551234567";
      const message = "Test";

      await handleGuestMessage(mockTwilioClient, message, sender, mockAdmins, twilioPhoneNumber, mockGuestData);

      const firstCall = mockTwilioClient.messages.create.mock.calls[0][0];
      expect(firstCall.body).toMatch(/^📱 Message from/);
    });

    test('should format message as "Message from Name (Phone):"', async () => {
      const sender = "+15551234567";
      const message = "Test";

      await handleGuestMessage(mockTwilioClient, message, sender, mockAdmins, twilioPhoneNumber, mockGuestData);

      const firstCall = mockTwilioClient.messages.create.mock.calls[0][0];
      expect(firstCall.body).toMatch(/📱 Message from John \(\+15551234567\):/);
    });

    test("should separate header from message body with double newline", async () => {
      const sender = "+15551234567";
      const message = "Test message";

      await handleGuestMessage(mockTwilioClient, message, sender, mockAdmins, twilioPhoneNumber, mockGuestData);

      const firstCall = mockTwilioClient.messages.create.mock.calls[0][0];
      expect(firstCall.body).toContain(":\n\n");
    });
  });

  describe("Error Handling", () => {
    test("should continue forwarding to other admins if one fails", async () => {
      const sender = "+15551234567";
      const message = "Test";

      // Mock first send to fail, second to succeed
      mockTwilioClient.messages.create
        .mockRejectedValueOnce(new Error("Twilio error"))
        .mockResolvedValueOnce({ sid: "mock-sid-2" });

      await handleGuestMessage(mockTwilioClient, message, sender, mockAdmins, twilioPhoneNumber, mockGuestData);

      // Should have attempted to send to both admins
      expect(mockTwilioClient.messages.create).toHaveBeenCalledTimes(2);
    });

    test("should handle Twilio API errors gracefully", async () => {
      const sender = "+15551234567";
      const message = "Test";

      mockTwilioClient.messages.create.mockRejectedValue(new Error("API Error"));

      await expect(
        handleGuestMessage(mockTwilioClient, message, sender, mockAdmins, twilioPhoneNumber, mockGuestData)
      ).resolves.not.toThrow();
    });

    test("should handle missing guest data gracefully", async () => {
      const sender = "+15551234567";
      const message = "Test";

      await expect(
        handleGuestMessage(mockTwilioClient, message, sender, mockAdmins, twilioPhoneNumber, null)
      ).resolves.not.toThrow();
    });

    test("should handle empty admins array", async () => {
      const sender = "+15551234567";
      const message = "Test";

      await handleGuestMessage(mockTwilioClient, message, sender, [], twilioPhoneNumber, mockGuestData);

      // Should not send any messages
      expect(mockTwilioClient.messages.create).not.toHaveBeenCalled();
    });
  });

  describe("STOP Request Handling", () => {
    test('should handle "STOP" command (lowercase)', async () => {
      const sender = "+15551234567";
      const message = "stop";

      updateSmsPreference.mockResolvedValue(true);

      await handleGuestMessage(mockTwilioClient, message, sender, mockAdmins, twilioPhoneNumber, mockGuestData);

      // Should call updateSmsPreference with false
      expect(updateSmsPreference).toHaveBeenCalledWith(sender, false);

      // Should send confirmation to guest
      expect(mockTwilioClient.messages.create).toHaveBeenCalledWith({
        body: "You have been unsubscribed from SMS messages. Reply 'START' to re-subscribe.",
        from: twilioPhoneNumber,
        to: sender,
      });

      // Should NOT forward to admins
      const forwardedMessages = mockTwilioClient.messages.create.mock.calls.filter((call) =>
        call[0].body.includes("📱 Message from")
      );
      expect(forwardedMessages.length).toBe(0);
    });

    test('should handle "STOP" command (uppercase)', async () => {
      const sender = "+15551234567";
      const message = "STOP";

      updateSmsPreference.mockResolvedValue(true);

      await handleGuestMessage(mockTwilioClient, message, sender, mockAdmins, twilioPhoneNumber, mockGuestData);

      expect(updateSmsPreference).toHaveBeenCalledWith(sender, false);
    });

    test('should handle "STOP" command (mixed case)', async () => {
      const sender = "+15551234567";
      const message = "StOp";

      updateSmsPreference.mockResolvedValue(true);

      await handleGuestMessage(mockTwilioClient, message, sender, mockAdmins, twilioPhoneNumber, mockGuestData);

      expect(updateSmsPreference).toHaveBeenCalledWith(sender, false);
    });

    test('should handle "STOP" with whitespace', async () => {
      const sender = "+15551234567";
      const message = "  stop  ";

      updateSmsPreference.mockResolvedValue(true);

      await handleGuestMessage(mockTwilioClient, message, sender, mockAdmins, twilioPhoneNumber, mockGuestData);

      expect(updateSmsPreference).toHaveBeenCalledWith(sender, false);
    });

    test('should NOT trigger STOP for messages containing "stop" in middle', async () => {
      const sender = "+15551234567";
      const message = "Please do not stop sending me updates";

      await handleGuestMessage(mockTwilioClient, message, sender, mockAdmins, twilioPhoneNumber, mockGuestData);

      // Should forward to admins, not unsubscribe
      expect(updateSmsPreference).not.toHaveBeenCalled();
      expect(mockTwilioClient.messages.create).toHaveBeenCalledTimes(2); // Forwarded to 2 admins
    });
  });

  describe("handleStopRequest Function", () => {
    test("should call updateSmsPreference with correct parameters", async () => {
      const sender = "+15551234567";
      updateSmsPreference.mockResolvedValue(true);

      await handleStopRequest(mockTwilioClient, sender, twilioPhoneNumber);

      expect(updateSmsPreference).toHaveBeenCalledWith(sender, false);
    });

    test("should send confirmation message when unsubscribe succeeds", async () => {
      const sender = "+15551234567";
      updateSmsPreference.mockResolvedValue(true);

      await handleStopRequest(mockTwilioClient, sender, twilioPhoneNumber);

      expect(mockTwilioClient.messages.create).toHaveBeenCalledWith({
        body: "You have been unsubscribed from SMS messages. Reply 'START' to re-subscribe.",
        from: twilioPhoneNumber,
        to: sender,
      });
    });

    test("should not send confirmation if unsubscribe fails", async () => {
      const sender = "+15551234567";
      updateSmsPreference.mockResolvedValue(false);

      await handleStopRequest(mockTwilioClient, sender, twilioPhoneNumber);

      // Should not send confirmation message
      expect(mockTwilioClient.messages.create).not.toHaveBeenCalled();
    });

    test("should handle updateSmsPreference errors gracefully", async () => {
      const sender = "+15551234567";
      updateSmsPreference.mockRejectedValue(new Error("Database error"));

      await expect(handleStopRequest(mockTwilioClient, sender, twilioPhoneNumber)).resolves.not.toThrow();

      // Should not send confirmation if error occurred
      expect(mockTwilioClient.messages.create).not.toHaveBeenCalled();
    });

    test("should handle Twilio errors when sending confirmation", async () => {
      const sender = "+15551234567";
      updateSmsPreference.mockResolvedValue(true);
      mockTwilioClient.messages.create.mockRejectedValue(new Error("Twilio error"));

      await expect(handleStopRequest(mockTwilioClient, sender, twilioPhoneNumber)).resolves.not.toThrow();
    });
  });

  describe("Real World Scenarios", () => {
    test("should handle guest asking about event details", async () => {
      const sender = "+15551234567"; // John
      const message = "What time does the event start? Also, is parking available?";

      await handleGuestMessage(mockTwilioClient, message, sender, mockAdmins, twilioPhoneNumber, mockGuestData);

      const firstCall = mockTwilioClient.messages.create.mock.calls[0][0];
      expect(firstCall.body).toContain("John");
      expect(firstCall.body).toContain("What time does the event start?");
      expect(mockTwilioClient.messages.create).toHaveBeenCalledTimes(2); // Forwarded to 2 admins
    });

    test("should handle guest confirming attendance", async () => {
      const sender = "+15551234568"; // Jane
      const message = "Yes, I will be there! Looking forward to it.";

      await handleGuestMessage(mockTwilioClient, message, sender, mockAdmins, twilioPhoneNumber, mockGuestData);

      const firstCall = mockTwilioClient.messages.create.mock.calls[0][0];
      expect(firstCall.body).toContain("Jane");
      expect(firstCall.body).toContain("Yes, I will be there!");
    });

    test("should handle guest opting out", async () => {
      const sender = "+15551234567";
      const message = "STOP";

      updateSmsPreference.mockResolvedValue(true);

      await handleGuestMessage(mockTwilioClient, message, sender, mockAdmins, twilioPhoneNumber, mockGuestData);

      // Should unsubscribe and send confirmation
      expect(updateSmsPreference).toHaveBeenCalledWith(sender, false);
      expect(mockTwilioClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining("unsubscribed"),
          to: sender,
        })
      );
    });

    test("should handle message from unknown guest", async () => {
      const unknownSender = "+15559998888";
      const message = "I think I was invited but not sure if I have the right number?";

      await handleGuestMessage(mockTwilioClient, message, unknownSender, mockAdmins, twilioPhoneNumber, mockGuestData);

      // Should forward with phone number as name
      const firstCall = mockTwilioClient.messages.create.mock.calls[0][0];
      expect(firstCall.body).toContain(unknownSender);
      expect(firstCall.body).toContain("I think I was invited");
      expect(mockTwilioClient.messages.create).toHaveBeenCalledTimes(2);
    });
  });
});

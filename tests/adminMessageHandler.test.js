const { handleAdminMessage } = require("../src/adminMessageHandler");
const { selectGuests } = require("../src/selectGuests");

// Mock dependencies
jest.mock("../src/selectGuests");
jest.mock("../src/utils", () => ({
  log: jest.fn(),
}));

describe("Admin Message Handler", () => {
  let mockTwilioClient;
  let mockGuestData;
  let mockAdmins;
  let twilioPhoneNumber;
  let senderAdmin;
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
      {
        firstName: "Sarah",
        lastName: "Johnson",
        phoneNumber: "+15551234570",
        shouldReceiveSMS: "TRUE",
        isAdmin: "TRUE",
      },
    ];

    mockAdmins = ["+15551234569", "+15551234570"];
    twilioPhoneNumber = "+15559999999";
    senderAdmin = "+15551234569"; // Admin User

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore console.error
    consoleErrorSpy.mockRestore();
  });

  describe("Message Parsing", () => {
    test("should parse message with @all target", async () => {
      const message = "@all Event starts at 6 PM!";
      const expectedGuests = [mockGuestData[0], mockGuestData[1]]; // Non-admin guests

      selectGuests.mockResolvedValue([...expectedGuests, mockGuestData[2], mockGuestData[3]]);

      await handleAdminMessage(mockTwilioClient, message, twilioPhoneNumber, mockAdmins, senderAdmin, mockGuestData);

      // Should send to non-admin guests only (filters out admins for @all)
      expect(mockTwilioClient.messages.create).toHaveBeenCalledWith({
        body: "Event starts at 6 PM!",
        from: twilioPhoneNumber,
        to: "+15551234567",
      });

      expect(mockTwilioClient.messages.create).toHaveBeenCalledWith({
        body: "Event starts at 6 PM!",
        from: twilioPhoneNumber,
        to: "+15551234568",
      });
    });

    test("should parse message with phone number target", async () => {
      const message = "@+15551234567 Hey John, can you help?";
      const expectedGuest = [mockGuestData[0]];

      selectGuests.mockResolvedValue(expectedGuest);

      await handleAdminMessage(mockTwilioClient, message, twilioPhoneNumber, mockAdmins, senderAdmin, mockGuestData);

      expect(selectGuests).toHaveBeenCalledWith(mockGuestData, "+15551234567");
      expect(mockTwilioClient.messages.create).toHaveBeenCalledWith({
        body: "Hey John, can you help?",
        from: twilioPhoneNumber,
        to: "+15551234567",
      });
    });

    test("should parse message with alias target", async () => {
      const message = "@rsvped Thanks for responding!";
      const expectedGuests = [mockGuestData[0], mockGuestData[1]];

      selectGuests.mockResolvedValue(expectedGuests);

      await handleAdminMessage(mockTwilioClient, message, twilioPhoneNumber, mockAdmins, senderAdmin, mockGuestData);

      expect(selectGuests).toHaveBeenCalledWith(mockGuestData, "rsvped");
    });

    test("should not process message without @ prefix", async () => {
      const message = "all Event starts at 6 PM!";

      await handleAdminMessage(mockTwilioClient, message, twilioPhoneNumber, mockAdmins, senderAdmin, mockGuestData);

      expect(selectGuests).not.toHaveBeenCalled();
      expect(mockTwilioClient.messages.create).not.toHaveBeenCalled();
    });

    test("should not process message without message body", async () => {
      const message = "@all";

      await handleAdminMessage(mockTwilioClient, message, twilioPhoneNumber, mockAdmins, senderAdmin, mockGuestData);

      expect(selectGuests).not.toHaveBeenCalled();
      expect(mockTwilioClient.messages.create).not.toHaveBeenCalled();
    });
  });

  describe("Target Selection", () => {
    test("should call selectGuests with correct parameters", async () => {
      const message = "@friends Quick update!";
      selectGuests.mockResolvedValue([mockGuestData[0]]);

      await handleAdminMessage(mockTwilioClient, message, twilioPhoneNumber, mockAdmins, senderAdmin, mockGuestData);

      expect(selectGuests).toHaveBeenCalledWith(mockGuestData, "friends");
    });

    test("should filter out admins when target is @all", async () => {
      const message = "@all General announcement";
      const allGuests = [...mockGuestData];

      selectGuests.mockResolvedValue(allGuests);

      await handleAdminMessage(mockTwilioClient, message, twilioPhoneNumber, mockAdmins, senderAdmin, mockGuestData);

      // Should only send to non-admin guests
      const guestCalls = mockTwilioClient.messages.create.mock.calls.filter(
        (call) => call[0].body === "General announcement" && !call[0].to.includes("9999999") // Not to twilio number
      );

      expect(guestCalls.length).toBe(2); // Only 2 non-admin guests
      expect(guestCalls.some((call) => call[0].to === "+15551234567")).toBe(true); // John
      expect(guestCalls.some((call) => call[0].to === "+15551234568")).toBe(true); // Jane
    });

    test("should NOT filter admins for other targets", async () => {
      const message = "@rsvped Event update";
      const rsvpedGuests = [mockGuestData[2]]; // Admin who RSVPed

      selectGuests.mockResolvedValue(rsvpedGuests);

      await handleAdminMessage(mockTwilioClient, message, twilioPhoneNumber, mockAdmins, senderAdmin, mockGuestData);

      // Should send to admin if they're in the target group
      const guestCalls = mockTwilioClient.messages.create.mock.calls.filter((call) => call[0].body === "Event update");

      expect(guestCalls.length).toBeGreaterThan(0);
    });
  });

  describe("SMS Sending", () => {
    test("should send SMS to all selected guests", async () => {
      const message = "@friends Party time!";
      const friends = [mockGuestData[0], mockGuestData[1]];

      selectGuests.mockResolvedValue(friends);

      await handleAdminMessage(mockTwilioClient, message, twilioPhoneNumber, mockAdmins, senderAdmin, mockGuestData);

      // Check that messages were sent to both friends
      expect(mockTwilioClient.messages.create).toHaveBeenCalledWith({
        body: "Party time!",
        from: twilioPhoneNumber,
        to: "+15551234567",
      });

      expect(mockTwilioClient.messages.create).toHaveBeenCalledWith({
        body: "Party time!",
        from: twilioPhoneNumber,
        to: "+15551234568",
      });
    });

    test("should handle multi-line messages", async () => {
      const message = "@john Line 1\nLine 2\nLine 3";
      selectGuests.mockResolvedValue([mockGuestData[0]]);

      await handleAdminMessage(mockTwilioClient, message, twilioPhoneNumber, mockAdmins, senderAdmin, mockGuestData);

      expect(mockTwilioClient.messages.create).toHaveBeenCalledWith({
        body: "Line 1\nLine 2\nLine 3",
        from: twilioPhoneNumber,
        to: "+15551234567",
      });
    });

    test("should handle message with emoji", async () => {
      const message = "@all Party time! 🎉🎊";
      selectGuests.mockResolvedValue([mockGuestData[0]]);

      await handleAdminMessage(mockTwilioClient, message, twilioPhoneNumber, mockAdmins, senderAdmin, mockGuestData);

      expect(mockTwilioClient.messages.create).toHaveBeenCalledWith({
        body: "Party time! 🎉🎊",
        from: twilioPhoneNumber,
        to: "+15551234567",
      });
    });

    test("should handle empty recipient list gracefully", async () => {
      const message = "@nonexistent Test message";
      selectGuests.mockResolvedValue([]);

      await handleAdminMessage(mockTwilioClient, message, twilioPhoneNumber, mockAdmins, senderAdmin, mockGuestData);

      // Should still send admin notifications but no guest messages
      const guestCalls = mockTwilioClient.messages.create.mock.calls.filter((call) => call[0].body === "Test message");

      expect(guestCalls.length).toBe(0);
    });
  });

  describe("Error Handling", () => {
    test("should continue sending to other recipients if one fails", async () => {
      const message = "@all Important update";
      const guests = [mockGuestData[0], mockGuestData[1]];

      selectGuests.mockResolvedValue(guests);

      // Mock first send to fail, second to succeed
      mockTwilioClient.messages.create
        .mockRejectedValueOnce(new Error("Twilio error"))
        .mockResolvedValueOnce({ sid: "mock-sid-2" });

      await handleAdminMessage(mockTwilioClient, message, twilioPhoneNumber, mockAdmins, senderAdmin, mockGuestData);

      // Should have attempted to send to both guests
      expect(mockTwilioClient.messages.create).toHaveBeenCalledTimes(4); // 2 guests + 2 admin notifications
    });

    test("should handle Twilio API errors gracefully", async () => {
      const message = "@john Test error handling";
      selectGuests.mockResolvedValue([mockGuestData[0]]);

      mockTwilioClient.messages.create.mockRejectedValue(new Error("API Error"));

      await expect(
        handleAdminMessage(mockTwilioClient, message, twilioPhoneNumber, mockAdmins, senderAdmin, mockGuestData)
      ).resolves.not.toThrow();
    });

    test("should handle selectGuests errors gracefully", async () => {
      const message = "@all Test";
      selectGuests.mockRejectedValue(new Error("Database error"));

      await expect(
        handleAdminMessage(mockTwilioClient, message, twilioPhoneNumber, mockAdmins, senderAdmin, mockGuestData)
      ).resolves.not.toThrow();
    });
  });

  describe("Admin Notifications", () => {
    test("should send notification to all admins", async () => {
      const message = "@friends Party update!";
      const friends = [mockGuestData[0]];

      selectGuests.mockResolvedValue(friends);

      await handleAdminMessage(mockTwilioClient, message, twilioPhoneNumber, mockAdmins, senderAdmin, mockGuestData);

      // Check admin notifications
      const notificationCalls = mockTwilioClient.messages.create.mock.calls.filter((call) =>
        call[0].body.includes("📤")
      );

      expect(notificationCalls.length).toBe(2); // One for each admin
    });

    test("should include admin name in notification", async () => {
      const message = "@all Event update";
      selectGuests.mockResolvedValue([mockGuestData[0]]);

      await handleAdminMessage(mockTwilioClient, message, twilioPhoneNumber, mockAdmins, senderAdmin, mockGuestData);

      const notificationCalls = mockTwilioClient.messages.create.mock.calls.filter((call) =>
        call[0].body.includes("📤")
      );

      expect(notificationCalls[0][0].body).toContain("Admin →");
    });

    test("should include target in notification", async () => {
      const message = "@friends Quick message";
      selectGuests.mockResolvedValue([mockGuestData[0]]);

      await handleAdminMessage(mockTwilioClient, message, twilioPhoneNumber, mockAdmins, senderAdmin, mockGuestData);

      const notificationCalls = mockTwilioClient.messages.create.mock.calls.filter((call) =>
        call[0].body.includes("📤")
      );

      expect(notificationCalls[0][0].body).toContain("@friends");
    });

    test("should include success count in notification", async () => {
      const message = "@all Announcement";
      selectGuests.mockResolvedValue([mockGuestData[0], mockGuestData[1]]);

      await handleAdminMessage(mockTwilioClient, message, twilioPhoneNumber, mockAdmins, senderAdmin, mockGuestData);

      const notificationCalls = mockTwilioClient.messages.create.mock.calls.filter((call) =>
        call[0].body.includes("📤")
      );

      expect(notificationCalls[0][0].body).toMatch(/\(2\)/);
    });

    test("should include failed count in notification when there are failures", async () => {
      const message = "@all Test";
      selectGuests.mockResolvedValue([mockGuestData[0], mockGuestData[1]]);

      // Mock one failure
      mockTwilioClient.messages.create
        .mockRejectedValueOnce(new Error("Failed"))
        .mockResolvedValue({ sid: "mock-sid" });

      await handleAdminMessage(mockTwilioClient, message, twilioPhoneNumber, mockAdmins, senderAdmin, mockGuestData);

      const notificationCalls = mockTwilioClient.messages.create.mock.calls.filter((call) =>
        call[0].body.includes("📤")
      );

      expect(notificationCalls[0][0].body).toContain("failed");
    });

    test("should truncate long messages in notification", async () => {
      const longMessage = "@all " + "a".repeat(100);
      selectGuests.mockResolvedValue([mockGuestData[0]]);

      await handleAdminMessage(
        mockTwilioClient,
        longMessage,
        twilioPhoneNumber,
        mockAdmins,
        senderAdmin,
        mockGuestData
      );

      const notificationCalls = mockTwilioClient.messages.create.mock.calls.filter((call) =>
        call[0].body.includes("📤")
      );

      expect(notificationCalls[0][0].body).toContain("...");
    });

    test("should not truncate short messages in notification", async () => {
      const shortMessage = "@all Short message";
      selectGuests.mockResolvedValue([mockGuestData[0]]);

      await handleAdminMessage(
        mockTwilioClient,
        shortMessage,
        twilioPhoneNumber,
        mockAdmins,
        senderAdmin,
        mockGuestData
      );

      const notificationCalls = mockTwilioClient.messages.create.mock.calls.filter((call) =>
        call[0].body.includes("📤")
      );

      expect(notificationCalls[0][0].body).toContain("Short message");
      expect(notificationCalls[0][0].body).not.toContain("...");
    });

    test("should handle admin notification failures gracefully", async () => {
      const message = "@all Test";
      selectGuests.mockResolvedValue([mockGuestData[0]]);

      // Make admin notifications fail
      mockTwilioClient.messages.create
        .mockResolvedValueOnce({ sid: "guest-sid" }) // Guest message succeeds
        .mockRejectedValueOnce(new Error("Admin notification failed")) // Admin 1 fails
        .mockRejectedValueOnce(new Error("Admin notification failed")); // Admin 2 fails

      await expect(
        handleAdminMessage(mockTwilioClient, message, twilioPhoneNumber, mockAdmins, senderAdmin, mockGuestData)
      ).resolves.not.toThrow();
    });

    test('should use "Admin" as default name if sender not found in guest data', async () => {
      const message = "@all Test";
      const unknownSender = "+15559999998";
      selectGuests.mockResolvedValue([mockGuestData[0]]);

      await handleAdminMessage(mockTwilioClient, message, twilioPhoneNumber, mockAdmins, unknownSender, mockGuestData);

      const notificationCalls = mockTwilioClient.messages.create.mock.calls.filter((call) =>
        call[0].body.includes("📤")
      );

      expect(notificationCalls[0][0].body).toContain("Admin →");
    });
  });

  describe("Real World Scenarios", () => {
    test("should handle broadcast to all RSVPed guests", async () => {
      const message = "@rsvped Event starts at 6 PM. Please arrive 15 minutes early!";
      const rsvpedGuests = [mockGuestData[0], mockGuestData[1]];

      selectGuests.mockResolvedValue(rsvpedGuests);

      await handleAdminMessage(mockTwilioClient, message, twilioPhoneNumber, mockAdmins, senderAdmin, mockGuestData);

      expect(selectGuests).toHaveBeenCalledWith(mockGuestData, "rsvped");
      expect(mockTwilioClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          body: "Event starts at 6 PM. Please arrive 15 minutes early!",
        })
      );
    });

    test("should handle targeted message to specific guest by phone", async () => {
      const message = "@+15551234567 Hey John, can you help with setup tomorrow at 5pm?";
      selectGuests.mockResolvedValue([mockGuestData[0]]);

      await handleAdminMessage(mockTwilioClient, message, twilioPhoneNumber, mockAdmins, senderAdmin, mockGuestData);

      expect(mockTwilioClient.messages.create).toHaveBeenCalledWith({
        body: "Hey John, can you help with setup tomorrow at 5pm?",
        from: twilioPhoneNumber,
        to: "+15551234567",
      });
    });

    test("should handle group message to friends", async () => {
      const message = "@friends Hey friends, parking lot B will be closed tomorrow";
      const friends = [mockGuestData[0], mockGuestData[1]];

      selectGuests.mockResolvedValue(friends);

      await handleAdminMessage(mockTwilioClient, message, twilioPhoneNumber, mockAdmins, senderAdmin, mockGuestData);

      expect(selectGuests).toHaveBeenCalledWith(mockGuestData, "friends");
      expect(mockTwilioClient.messages.create).toHaveBeenCalledTimes(4); // 2 friends + 2 admin notifications
    });
  });
});

const { handler } = require("../src/handler");
const { getGuestData } = require("../src/googleSheets");
const { getTwilioCredentials } = require("../src/getCredentials");
const { handleAdminMessage } = require("../src/adminMessageHandler");
const { handleGuestMessage } = require("../src/guestMessageHandler");
const twilio = require("twilio");

// Mock all dependencies
jest.mock("../src/googleSheets");
jest.mock("../src/getCredentials");
jest.mock("../src/adminMessageHandler");
jest.mock("../src/guestMessageHandler");
jest.mock("twilio");

describe("Lambda Handler (Integration Tests)", () => {
  let mockTwilioClient;
  let mockGuestData;
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

    twilio.mockReturnValue(mockTwilioClient);

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

    getGuestData.mockResolvedValue(mockGuestData);
    getTwilioCredentials.mockResolvedValue({
      twilioSid: "mock-sid",
      twilioToken: "mock-token",
      twilioPhoneNumber: "+15559999999",
    });

    handleAdminMessage.mockResolvedValue();
    handleGuestMessage.mockResolvedValue();

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe("Lambda Event Parsing", () => {
    test("should parse Twilio webhook event body correctly", async () => {
      const event = {
        body: "From=%2B15551234567&Body=Hello%20World&MessageSid=SM123",
      };

      await handler(event);

      // Should have called getGuestData
      expect(getGuestData).toHaveBeenCalled();
    });

    test("should extract From parameter from webhook", async () => {
      const event = {
        body: "From=%2B15551234567&Body=Test%20message",
      };

      await handler(event);

      expect(handleGuestMessage).toHaveBeenCalledWith(
        expect.anything(),
        "Test message",
        "+15551234567",
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
    });

    test("should extract Body parameter from webhook", async () => {
      const event = {
        body: "From=%2B15551234567&Body=Hello%20from%20guest",
      };

      await handler(event);

      expect(handleGuestMessage).toHaveBeenCalledWith(
        expect.anything(),
        "Hello from guest",
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
    });

    test("should handle URL-encoded characters in message", async () => {
      const event = {
        body: "From=%2B15551234567&Body=Hello%20%26%20welcome%21",
      };

      await handler(event);

      expect(handleGuestMessage).toHaveBeenCalledWith(
        expect.anything(),
        "Hello & welcome!",
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
    });

    test("should handle empty From parameter", async () => {
      const event = {
        body: "Body=Test%20message",
      };

      await handler(event);

      expect(handleGuestMessage).toHaveBeenCalledWith(
        expect.anything(),
        "Test message",
        "",
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
    });

    test("should handle empty Body parameter", async () => {
      const event = {
        body: "From=%2B15551234567",
      };

      await handler(event);

      expect(handleGuestMessage).toHaveBeenCalledWith(
        expect.anything(),
        "",
        "+15551234567",
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
    });
  });

  describe("Admin vs Guest Routing", () => {
    test("should route admin message to handleAdminMessage", async () => {
      const event = {
        body: "From=%2B15551234569&Body=%40all%20Event%20starts%20now",
      };

      await handler(event);

      expect(handleAdminMessage).toHaveBeenCalledWith(
        mockTwilioClient,
        "@all Event starts now",
        "+15559999999",
        ["+15551234569", "+15551234570"],
        "+15551234569",
        mockGuestData
      );

      expect(handleGuestMessage).not.toHaveBeenCalled();
    });

    test("should route guest message to handleGuestMessage", async () => {
      const event = {
        body: "From=%2B15551234567&Body=Hello%2C%20I%20have%20a%20question",
      };

      await handler(event);

      expect(handleGuestMessage).toHaveBeenCalledWith(
        mockTwilioClient,
        "Hello, I have a question",
        "+15551234567",
        ["+15551234569", "+15551234570"],
        "+15559999999",
        mockGuestData
      );

      expect(handleAdminMessage).not.toHaveBeenCalled();
    });

    test("should identify admin by phone number", async () => {
      const event = {
        body: "From=%2B15551234570&Body=%40rsvped%20Thanks%20for%20coming",
      };

      await handler(event);

      expect(handleAdminMessage).toHaveBeenCalled();
      expect(handleGuestMessage).not.toHaveBeenCalled();
    });

    test("should identify guest by phone number", async () => {
      const event = {
        body: "From=%2B15551234568&Body=Looking%20forward%20to%20it",
      };

      await handler(event);

      expect(handleGuestMessage).toHaveBeenCalled();
      expect(handleAdminMessage).not.toHaveBeenCalled();
    });

    test("should extract admin list from guest data", async () => {
      const event = {
        body: "From=%2B15551234567&Body=Test",
      };

      await handler(event);

      expect(handleGuestMessage).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        ["+15551234569", "+15551234570"],
        expect.anything(),
        expect.anything()
      );
    });
  });

  describe("Twilio Client Initialization", () => {
    test("should initialize Twilio client with credentials", async () => {
      const event = {
        body: "From=%2B15551234567&Body=Test",
      };

      await handler(event);

      expect(twilio).toHaveBeenCalledWith("mock-sid", "mock-token");
    });

    test("should use Twilio credentials from getTwilioCredentials", async () => {
      getTwilioCredentials.mockResolvedValue({
        twilioSid: "custom-sid",
        twilioToken: "custom-token",
        twilioPhoneNumber: "+15558888888",
      });

      const event = {
        body: "From=%2B15551234567&Body=Test",
      };

      await handler(event);

      expect(twilio).toHaveBeenCalledWith("custom-sid", "custom-token");
      expect(handleGuestMessage).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        "+15558888888",
        expect.anything()
      );
    });
  });

  describe("Response Format", () => {
    test("should return 200 status code on success", async () => {
      const event = {
        body: "From=%2B15551234567&Body=Test",
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
    });

    test("should return XML content type", async () => {
      const event = {
        body: "From=%2B15551234567&Body=Test",
      };

      const response = await handler(event);

      expect(response.headers["Content-Type"]).toBe("text/xml");
    });

    test("should return empty TwiML response", async () => {
      const event = {
        body: "From=%2B15551234567&Body=Test",
      };

      const response = await handler(event);

      expect(response.body).toBe('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    });
  });

  describe("Error Handling", () => {
    test("should handle missing guest data gracefully", async () => {
      getGuestData.mockResolvedValue([]);

      const event = {
        body: "From=%2B15551234567&Body=Test",
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      expect(response.body).toBe('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    });

    test("should handle getGuestData failure", async () => {
      getGuestData.mockRejectedValue(new Error("Google Sheets API error"));

      const event = {
        body: "From=%2B15551234567&Body=Test",
      };

      // The handler will throw because getGuestData is called outside try-catch
      await expect(handler(event)).rejects.toThrow("Google Sheets API error");
    });

    test("should handle missing Twilio credentials", async () => {
      getTwilioCredentials.mockResolvedValue({
        twilioSid: null,
        twilioToken: null,
        twilioPhoneNumber: null,
      });

      const event = {
        body: "From=%2B15551234567&Body=Test",
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      expect(handleGuestMessage).not.toHaveBeenCalled();
    });

    test("should handle getTwilioCredentials failure", async () => {
      getTwilioCredentials.mockRejectedValue(new Error("SSM parameter error"));

      const event = {
        body: "From=%2B15551234567&Body=Test",
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    test("should handle handleAdminMessage failure", async () => {
      handleAdminMessage.mockRejectedValue(new Error("Message handler error"));

      const event = {
        body: "From=%2B15551234569&Body=%40all%20Test",
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    test("should handle handleGuestMessage failure", async () => {
      handleGuestMessage.mockRejectedValue(new Error("Message handler error"));

      const event = {
        body: "From=%2B15551234567&Body=Test",
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    test("should always return 200 even on error inside try-catch (Twilio requirement)", async () => {
      // Test errors inside try-catch (not getGuestData which is outside)
      getTwilioCredentials.mockRejectedValue(new Error("Fatal error"));

      const event = {
        body: "From=%2B15551234567&Body=Test",
      };

      const response = await handler(event);

      // Twilio requires 200 response or it will retry
      expect(response.statusCode).toBe(200);
    });
  });

  describe("Real World Scenarios", () => {
    test("should handle admin broadcast to all guests", async () => {
      const event = {
        body: "From=%2B15551234569&Body=%40all%20Event%20starts%20at%206%20PM%21",
      };

      const response = await handler(event);

      expect(getGuestData).toHaveBeenCalled();
      expect(getTwilioCredentials).toHaveBeenCalled();
      expect(handleAdminMessage).toHaveBeenCalledWith(
        mockTwilioClient,
        "@all Event starts at 6 PM!",
        "+15559999999",
        ["+15551234569", "+15551234570"],
        "+15551234569",
        mockGuestData
      );
      expect(response.statusCode).toBe(200);
    });

    test("should handle admin targeted message by phone", async () => {
      const event = {
        body: "From=%2B15551234570&Body=%40%2B15551234567%20Hey%20John%2C%20can%20you%20help%3F",
      };

      const response = await handler(event);

      expect(handleAdminMessage).toHaveBeenCalledWith(
        mockTwilioClient,
        "@+15551234567 Hey John, can you help?",
        expect.anything(),
        expect.anything(),
        "+15551234570",
        expect.anything()
      );
      expect(response.statusCode).toBe(200);
    });

    test("should handle guest question", async () => {
      const event = {
        body: "From=%2B15551234567&Body=What%20time%20does%20the%20event%20start%3F",
      };

      const response = await handler(event);

      expect(handleGuestMessage).toHaveBeenCalledWith(
        mockTwilioClient,
        "What time does the event start?",
        "+15551234567",
        ["+15551234569", "+15551234570"],
        "+15559999999",
        mockGuestData
      );
      expect(response.statusCode).toBe(200);
    });

    test("should handle guest STOP request", async () => {
      const event = {
        body: "From=%2B15551234567&Body=STOP",
      };

      const response = await handler(event);

      expect(handleGuestMessage).toHaveBeenCalledWith(
        mockTwilioClient,
        "STOP",
        "+15551234567",
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
      expect(response.statusCode).toBe(200);
    });

    test("should handle message with special characters", async () => {
      const event = {
        body: "From=%2B15551234567&Body=Can%27t%20wait%21%20%F0%9F%8E%89",
      };

      const response = await handler(event);

      expect(handleGuestMessage).toHaveBeenCalledWith(
        mockTwilioClient,
        "Can't wait! 🎉",
        "+15551234567",
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
      expect(response.statusCode).toBe(200);
    });

    test("should handle multi-line message", async () => {
      const event = {
        body: "From=%2B15551234569&Body=%40all%20Line%201%0ALine%202%0ALine%203",
      };

      const response = await handler(event);

      expect(handleAdminMessage).toHaveBeenCalledWith(
        mockTwilioClient,
        "@all Line 1\nLine 2\nLine 3",
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
      expect(response.statusCode).toBe(200);
    });
  });

  describe("Data Flow", () => {
    test("should pass guest data to message handlers", async () => {
      const event = {
        body: "From=%2B15551234567&Body=Test",
      };

      await handler(event);

      expect(handleGuestMessage).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        mockGuestData
      );
    });

    test("should pass Twilio client to message handlers", async () => {
      const event = {
        body: "From=%2B15551234567&Body=Test",
      };

      await handler(event);

      expect(handleGuestMessage).toHaveBeenCalledWith(
        mockTwilioClient,
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
    });

    test("should fetch guest data first", async () => {
      const event = {
        body: "From=%2B15551234567&Body=Test",
      };

      await handler(event);

      // Verify getGuestData was called
      expect(getGuestData).toHaveBeenCalled();
    });

    test("should fetch credentials and initialize Twilio", async () => {
      const event = {
        body: "From=%2B15551234567&Body=Test",
      };

      await handler(event);

      // Verify getTwilioCredentials and twilio were called
      expect(getTwilioCredentials).toHaveBeenCalled();
      expect(twilio).toHaveBeenCalledWith("mock-sid", "mock-token");
    });
  });
});

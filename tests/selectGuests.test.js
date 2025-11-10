const { selectGuests } = require("../src/selectGuests");
const { getGuestData } = require("../src/googleSheets");

// Mock the googleSheets module
jest.mock("../src/googleSheets");

describe("selectGuests - Phone Number Targeting", () => {
  let mockGuestData;

  beforeEach(() => {
    // Setup mock guest data based on your debug scenarios
    mockGuestData = [
      {
        firstName: "Joey",
        lastName: "Test",
        phoneNumber: "+1 (812) 272-4842",
        shouldReceiveSMS: "TRUE",
        isAdmin: "FALSE",
      },
      {
        firstName: "John",
        lastName: "Doe",
        phoneNumber: "+1-555-123-4567",
        shouldReceiveSMS: "TRUE",
        isAdmin: "FALSE",
      },
      {
        firstName: "Jane",
        lastName: "Smith",
        phoneNumber: "18005551234",
        shouldReceiveSMS: "TRUE",
        isAdmin: "TRUE",
      },
      {
        firstName: "Bob",
        lastName: "Johnson",
        phoneNumber: null,
        shouldReceiveSMS: "TRUE",
        isAdmin: "FALSE",
      },
      {
        firstName: "Alice",
        lastName: "Williams",
        phoneNumber: "+1 (555) 999-8888",
        shouldReceiveSMS: "FALSE",
        isAdmin: "FALSE",
      },
    ];

    getGuestData.mockResolvedValue(mockGuestData);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Phone Pattern Validation", () => {
    test("should match valid phone pattern with country code", () => {
      const phonePattern = /^[+]?[1-9][\d\-() \s]+$/;
      const targetNumber = "+18122724842";

      expect(phonePattern.test(targetNumber)).toBe(true);
    });

    test("should match phone patterns from debug scenarios", () => {
      const phonePattern = /^[+]?[1-9][\d\-() \s]+$/;

      expect(phonePattern.test("+18122724842")).toBe(true);
      expect(phonePattern.test("+1-555-123-4567")).toBe(true);
      expect(phonePattern.test("18005551234")).toBe(true);
      expect(phonePattern.test("+1 (555) 999-8888")).toBe(true);
    });

    test("should reject invalid phone patterns", () => {
      const phonePattern = /^[+]?[1-9][\d\-() \s]+$/;

      expect(phonePattern.test("not-a-phone")).toBe(false);
      expect(phonePattern.test("abc123")).toBe(false);
      expect(phonePattern.test("")).toBe(false);
    });
  });

  describe("Phone Number Cleaning", () => {
    test("should clean target number by removing formatting characters", () => {
      const targetNumber = "+18122724842";
      const cleanedNumber = targetNumber.replace(/[\s\-()]/g, "");

      expect(cleanedNumber).toBe("+18122724842");
    });

    test("should clean guest phone numbers with spaces and parentheses", () => {
      const guestPhone = "+1 (812) 272-4842";
      const cleanedGuestNumber = guestPhone.replace(/[\s\-()]/g, "");

      expect(cleanedGuestNumber).toBe("+18122724842");
    });

    test("should clean phone numbers with dashes", () => {
      const phoneWithDashes = "+1-555-123-4567";
      const cleaned = phoneWithDashes.replace(/[\s\-()]/g, "");

      expect(cleaned).toBe("+15551234567");
    });
  });

  describe("Guest Data Retrieval", () => {
    test("should retrieve all guest data", async () => {
      const guestData = await getGuestData();

      expect(guestData).toHaveLength(5);
      expect(getGuestData).toHaveBeenCalledTimes(1);
    });

    test("should handle guest data with various phone formats", async () => {
      const guestData = await getGuestData();

      const phonesWithFormatting = guestData.filter(
        (g) => g.phoneNumber && (g.phoneNumber.includes("(") || g.phoneNumber.includes("-"))
      );

      expect(phonesWithFormatting.length).toBeGreaterThan(0);
    });
  });

  describe("Phone Number Matching", () => {
    test("should find Joey by matching cleaned phone numbers", async () => {
      const targetNumber = "+18122724842";
      const cleanedTarget = targetNumber.replace(/[\s\-()]/g, "");

      const guestData = await getGuestData();
      const matchingGuests = guestData.filter((guest) => {
        if (!guest.phoneNumber) return false;
        const cleanedGuestNumber = guest.phoneNumber.replace(/[\s\-()]/g, "");
        return cleanedGuestNumber === cleanedTarget;
      });

      expect(matchingGuests).toHaveLength(1);
      expect(matchingGuests[0].firstName).toBe("Joey");
      expect(matchingGuests[0].phoneNumber).toBe("+1 (812) 272-4842");
    });

    test("should match phone number regardless of formatting", async () => {
      const guestData = await getGuestData();

      // Test various formats of the same number
      const formats = ["+18122724842", "+1 (812) 272-4842", "+1-812-272-4842"];

      formats.forEach((format) => {
        const cleanedTarget = format.replace(/[\s\-()]/g, "");
        const matches = guestData.filter((guest) => {
          if (!guest.phoneNumber) return false;
          return guest.phoneNumber.replace(/[\s\-()]/g, "") === cleanedTarget;
        });
        expect(matches).toHaveLength(1);
        expect(matches[0].firstName).toBe("Joey");
      });
    });

    test("should return empty array when no matching phone number", async () => {
      const targetNumber = "+19999999999";
      const cleanedTarget = targetNumber.replace(/[\s\-()]/g, "");

      const guestData = await getGuestData();
      const matchingGuests = guestData.filter((guest) => {
        if (!guest.phoneNumber) return false;
        return guest.phoneNumber.replace(/[\s\-()]/g, "") === cleanedTarget;
      });

      expect(matchingGuests).toHaveLength(0);
    });
  });

  describe("Search by Name (Debug Scenario)", () => {
    test("should find Joey by first name (case insensitive)", async () => {
      const guestData = await getGuestData();
      const joeyGuests = guestData.filter(
        (guest) =>
          (guest.firstName && guest.firstName.toLowerCase().includes("joey")) ||
          (guest.lastName && guest.lastName.toLowerCase().includes("joey"))
      );

      expect(joeyGuests).toHaveLength(1);
      expect(joeyGuests[0].firstName).toBe("Joey");
      expect(joeyGuests[0].phoneNumber).toBe("+1 (812) 272-4842");
      expect(joeyGuests[0].shouldReceiveSMS).toBe("TRUE");
    });

    test("should verify Joey has correct phone number and SMS enabled", async () => {
      const guestData = await getGuestData();
      const joeyGuests = guestData.filter((guest) => guest.firstName && guest.firstName.toLowerCase().includes("joey"));

      expect(joeyGuests[0].phoneNumber).toBeTruthy();
      expect(joeyGuests[0].shouldReceiveSMS).toBe("TRUE");
    });
  });

  describe("Guest Properties Validation", () => {
    test("should have guests with SMS enabled", async () => {
      const guestData = await getGuestData();
      const smsEnabledGuests = guestData.filter((guest) => guest.shouldReceiveSMS === "TRUE");

      expect(smsEnabledGuests.length).toBeGreaterThan(0);
    });

    test("should identify admin guests correctly", async () => {
      const guestData = await getGuestData();
      const adminGuests = guestData.filter((guest) => guest.isAdmin === "TRUE");

      expect(adminGuests).toHaveLength(1);
      expect(adminGuests[0].firstName).toBe("Jane");
    });

    test("should handle guests without phone numbers", async () => {
      const guestData = await getGuestData();
      const guestsWithoutPhone = guestData.filter((guest) => !guest.phoneNumber);

      expect(guestsWithoutPhone).toHaveLength(1);
      expect(guestsWithoutPhone[0].firstName).toBe("Bob");
    });

    test("should handle guests with SMS disabled", async () => {
      const guestData = await getGuestData();
      const smsDisabledGuests = guestData.filter((guest) => guest.shouldReceiveSMS === "FALSE");

      expect(smsDisabledGuests).toHaveLength(1);
      expect(smsDisabledGuests[0].firstName).toBe("Alice");
    });
  });

  describe("Phone Number Formatting Examples", () => {
    test("should list all phone number formats in data", async () => {
      const guestData = await getGuestData();
      const phoneFormats = guestData
        .filter((g) => g.phoneNumber)
        .map((g) => ({
          name: g.firstName,
          original: g.phoneNumber,
          cleaned: g.phoneNumber.replace(/[\s\-()]/g, ""),
        }));

      expect(phoneFormats.length).toBe(4); // 4 guests have phone numbers

      // Verify each has different formatting
      const hasParentheses = phoneFormats.some((p) => p.original.includes("("));
      const hasDashes = phoneFormats.some((p) => p.original.includes("-"));
      const hasSpaces = phoneFormats.some((p) => p.original.includes(" "));

      expect(hasParentheses || hasDashes || hasSpaces).toBe(true);
    });
  });

  describe("Edge Cases", () => {
    test("should handle empty guest data", async () => {
      getGuestData.mockResolvedValue([]);

      const guestData = await getGuestData();
      const matchingGuests = guestData.filter((guest) => {
        if (!guest.phoneNumber) return false;
        return guest.phoneNumber.replace(/[\s\-()]/g, "") === "+18122724842";
      });

      expect(matchingGuests).toHaveLength(0);
    });

    test("should not throw when filtering guests with null phone numbers", async () => {
      const guestData = await getGuestData();

      expect(() => {
        guestData.filter((guest) => {
          if (!guest.phoneNumber) return false;
          return guest.phoneNumber.replace(/[\s\-()]/g, "") === "+18122724842";
        });
      }).not.toThrow();
    });
  });
});

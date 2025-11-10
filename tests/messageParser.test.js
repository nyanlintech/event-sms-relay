describe("Admin Message Parser", () => {
  // Regex patterns from adminMessageHandler.js
  const PHONE_NUMBER_REGEX = /^@(\+1\d{10})\s+(.+)/s;
  const ALIAS_REGEX = /^@(\S+)\s+(.+)/s;

  const parseMessage = (message) => {
    if (message.startsWith("@+1")) {
      const phoneMatch = message.match(PHONE_NUMBER_REGEX);
      if (phoneMatch) {
        return phoneMatch;
      }
    }

    return message.match(ALIAS_REGEX);
  };

  describe("Phone Number Pattern Matching", () => {
    test("should match phone number with @+1 prefix and 10 digits", () => {
      const message = "@+18122724842 Hey Joey this is Nyan";
      const match = parseMessage(message);
      const [, target, body] = match || [];

      expect(match).toBeTruthy();
      expect(target).toBe("+18122724842");
      expect(body).toBe("Hey Joey this is Nyan");
    });

    test("should match phone number with exact +1 format", () => {
      const message = "@+15551234567 Test US number";
      const match = parseMessage(message);
      const [, target, body] = match || [];

      expect(match).toBeTruthy();
      expect(target).toBe("+15551234567");
      expect(body).toBe("Test US number");
    });

    test("should extract phone number correctly from @+1XXXXXXXXXX format", () => {
      const message = "@+18005551234 Important update";
      const match = parseMessage(message);
      const [, target, body] = match || [];

      expect(match).toBeTruthy();
      expect(target).toBe("+18005551234");
      expect(body).toBe("Important update");
    });

    test("should handle multi-line message body", () => {
      const message = "@+18122724842 Line 1\nLine 2\nLine 3";
      const match = parseMessage(message);
      const [, target, body] = match || [];

      expect(match).toBeTruthy();
      expect(target).toBe("+18122724842");
      expect(body).toBe("Line 1\nLine 2\nLine 3");
    });
  });

  describe("Alias Pattern Matching", () => {
    test("should match @all alias", () => {
      const message = "@all Hey everyone";
      const match = parseMessage(message);
      const [, target, body] = match || [];

      expect(match).toBeTruthy();
      expect(target).toBe("all");
      expect(body).toBe("Hey everyone");
    });

    test("should match @rsvped alias", () => {
      const message = "@rsvped Thanks for responding!";
      const match = parseMessage(message);
      const [, target, body] = match || [];

      expect(match).toBeTruthy();
      expect(target).toBe("rsvped");
      expect(body).toBe("Thanks for responding!");
    });

    test("should match name target", () => {
      const message = "@john Hey there";
      const match = parseMessage(message);
      const [, target, body] = match || [];

      expect(match).toBeTruthy();
      expect(target).toBe("john");
      expect(body).toBe("Hey there");
    });

    test("should match party name target", () => {
      const message = "@family1 Family update";
      const match = parseMessage(message);
      const [, target, body] = match || [];

      expect(match).toBeTruthy();
      expect(target).toBe("family1");
      expect(body).toBe("Family update");
    });

    test("should match @friends group", () => {
      const message = "@friends Quick message";
      const match = parseMessage(message);
      const [, target, body] = match || [];

      expect(match).toBeTruthy();
      expect(target).toBe("friends");
      expect(body).toBe("Quick message");
    });
  });

  describe("Edge Cases and Invalid Formats", () => {
    test("should NOT match phone number with dashes (falls back to alias)", () => {
      // This will match the ALIAS_REGEX but not PHONE_NUMBER_REGEX
      const message = "@+1-555-123-4567 Test with dashes";
      const match = parseMessage(message);
      const [, target, body] = match || [];

      // It matches as an alias, not a phone number
      expect(match).toBeTruthy();
      expect(target).toBe("+1-555-123-4567"); // Captured as alias
      expect(body).toBe("Test with dashes");
    });

    test("should NOT match phone number with spaces (falls back to alias)", () => {
      // First word only is captured as alias
      const message = "@+1 555 123 4567 Test with spaces";
      const match = parseMessage(message);
      const [, target, body] = match || [];

      expect(match).toBeTruthy();
      expect(target).toBe("+1"); // Only first non-whitespace captured
      expect(body).toBe("555 123 4567 Test with spaces");
    });

    test("should NOT match invalid format without @", () => {
      const message = "not a valid message";
      const match = parseMessage(message);

      expect(match).toBeNull();
    });

    test("should NOT match @target without message body", () => {
      const message = "@target";
      const match = parseMessage(message);

      expect(match).toBeNull();
    });

    test("should NOT match @invalid without body", () => {
      const message = "@invalid";
      const match = parseMessage(message);

      expect(match).toBeNull();
    });

    test("should NOT match message with only @ symbol", () => {
      const message = "@";
      const match = parseMessage(message);

      expect(match).toBeNull();
    });

    test("should NOT match empty string", () => {
      const message = "";
      const match = parseMessage(message);

      expect(match).toBeNull();
    });
  });

  describe("Phone Number Regex Specifics", () => {
    test("PHONE_NUMBER_REGEX should require exactly +1 followed by 10 digits", () => {
      expect(PHONE_NUMBER_REGEX.test("@+18122724842 message")).toBe(true);
      expect(PHONE_NUMBER_REGEX.test("@+15551234567 message")).toBe(true);
    });

    test("PHONE_NUMBER_REGEX should reject +1 with wrong digit count", () => {
      expect(PHONE_NUMBER_REGEX.test("@+1812272484 message")).toBe(false); // 9 digits
      expect(PHONE_NUMBER_REGEX.test("@+181227248422 message")).toBe(false); // 11 digits
    });

    test("PHONE_NUMBER_REGEX should reject phone with formatting", () => {
      expect(PHONE_NUMBER_REGEX.test("@+1-812-272-4842 message")).toBe(false);
      expect(PHONE_NUMBER_REGEX.test("@+1 (812) 272-4842 message")).toBe(false);
    });

    test("PHONE_NUMBER_REGEX should reject without +1 prefix", () => {
      expect(PHONE_NUMBER_REGEX.test("@8122724842 message")).toBe(false);
    });
  });

  describe("ALIAS_REGEX Specifics", () => {
    test("ALIAS_REGEX should match any non-whitespace target", () => {
      expect(ALIAS_REGEX.test("@all message")).toBe(true);
      expect(ALIAS_REGEX.test("@john message")).toBe(true);
      expect(ALIAS_REGEX.test("@123 message")).toBe(true);
      expect(ALIAS_REGEX.test("@family1 message")).toBe(true);
    });

    test("ALIAS_REGEX should capture only first word as target", () => {
      const message = "@target with multiple words in message";
      const match = message.match(ALIAS_REGEX);
      const [, target, body] = match || [];

      expect(target).toBe("target");
      expect(body).toBe("with multiple words in message");
    });

    test("ALIAS_REGEX should handle multi-line messages", () => {
      const message = "@all Line 1\nLine 2";
      const match = message.match(ALIAS_REGEX);
      const [, target, body] = match || [];

      expect(target).toBe("all");
      expect(body).toBe("Line 1\nLine 2");
    });
  });

  describe("Real World Examples", () => {
    test("should parse admin message to specific guest by phone", () => {
      const message = "@+18122724842 Hey Joey, can you help with setup tomorrow at 5pm?";
      const match = parseMessage(message);
      const [, target, body] = match || [];

      expect(match).toBeTruthy();
      expect(target).toBe("+18122724842");
      expect(body).toBe("Hey Joey, can you help with setup tomorrow at 5pm?");
    });

    test("should parse broadcast to all RSVPed guests", () => {
      const message = "@rsvped Event starts at 6 PM. Please arrive 15 minutes early!";
      const match = parseMessage(message);
      const [, target, body] = match || [];

      expect(match).toBeTruthy();
      expect(target).toBe("rsvped");
      expect(body).toBe("Event starts at 6 PM. Please arrive 15 minutes early!");
    });

    test("should parse message to friends group", () => {
      const message = "@friends Hey friends, quick update: parking lot B will be closed";
      const match = parseMessage(message);
      const [, target, body] = match || [];

      expect(match).toBeTruthy();
      expect(target).toBe("friends");
      expect(body).toBe("Hey friends, quick update: parking lot B will be closed");
    });

    test("should parse message to specific person by name", () => {
      const message = "@john Thanks for volunteering!";
      const match = parseMessage(message);
      const [, target, body] = match || [];

      expect(match).toBeTruthy();
      expect(target).toBe("john");
      expect(body).toBe("Thanks for volunteering!");
    });
  });

  describe("Message Format Validation", () => {
    test("should require space between target and message", () => {
      const messageNoSpace = "@alltesting";
      const match = parseMessage(messageNoSpace);

      // This would match with 'alltesting' as target and no body
      expect(match).toBeNull();
    });

    test("should handle extra spaces between target and message", () => {
      const message = "@all    Multiple spaces before message";
      const match = parseMessage(message);
      const [, target, body] = match || [];

      expect(match).toBeTruthy();
      expect(target).toBe("all");
      // The regex \s+ matches spaces, then (.+) captures from first non-whitespace
      expect(body).toBe("Multiple spaces before message");
    });

    test("should handle message with emoji", () => {
      const message = "@all Party time! 🎉🎊";
      const match = parseMessage(message);
      const [, target, body] = match || [];

      expect(match).toBeTruthy();
      expect(target).toBe("all");
      expect(body).toBe("Party time! 🎉🎊");
    });

    test("should handle message with URLs", () => {
      const message = "@rsvped Check directions: https://maps.google.com/location";
      const match = parseMessage(message);
      const [, target, body] = match || [];

      expect(match).toBeTruthy();
      expect(target).toBe("rsvped");
      expect(body).toBe("Check directions: https://maps.google.com/location");
    });
  });
});

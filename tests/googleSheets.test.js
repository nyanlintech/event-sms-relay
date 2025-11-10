const { getGuestData, updateSmsPreference } = require('../src/googleSheets');
const { google } = require('googleapis');
const { getGSheetCredentials } = require('../src/getCredentials');

// Mock dependencies
jest.mock('googleapis');
jest.mock('../src/getCredentials');
jest.mock('../src/utils', () => ({
  log: jest.fn(),
}));

describe('Google Sheets Integration', () => {
  let mockSheets;
  let mockAuth;
  let consoleErrorSpy;

  beforeEach(() => {
    // Mock console.error to suppress error logs in tests
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Mock Google Sheets API
    mockSheets = {
      spreadsheets: {
        values: {
          get: jest.fn(),
          update: jest.fn(),
        },
      },
    };

    // Mock JWT auth
    mockAuth = {
      authorize: jest.fn().mockResolvedValue(),
    };

    google.auth = {
      JWT: jest.fn().mockImplementation(() => mockAuth),
    };

    google.sheets = jest.fn().mockReturnValue(mockSheets);

    // Mock credentials
    getGSheetCredentials.mockResolvedValue({
      gClientEmail: 'test@example.com',
      gPrivateKey: 'mock-private-key',
      gSpreadSheetId: 'mock-spreadsheet-id',
    });

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('getGuestData', () => {
    test('should fetch and parse guest data from Google Sheets', async () => {
      const mockResponse = {
        data: {
          values: [
            ['firstName', 'lastName', 'phoneNumber', 'shouldReceiveSMS', 'isAdmin'],
            ['John', 'Doe', '+15551234567', 'TRUE', 'FALSE'],
            ['Jane', 'Smith', '+15551234568', 'TRUE', 'TRUE'],
          ],
        },
      };

      mockSheets.spreadsheets.values.get.mockResolvedValue(mockResponse);

      const result = await getGuestData();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        firstName: 'John',
        lastName: 'Doe',
        phoneNumber: '+15551234567',
        shouldReceiveSMS: 'TRUE',
        isAdmin: 'FALSE',
      });
      expect(result[1]).toEqual({
        firstName: 'Jane',
        lastName: 'Smith',
        phoneNumber: '+15551234568',
        shouldReceiveSMS: 'TRUE',
        isAdmin: 'TRUE',
      });
    });

    test('should initialize Google Sheets with credentials', async () => {
      const mockResponse = {
        data: {
          values: [
            ['firstName', 'phoneNumber'],
            ['John', '+15551234567'],
          ],
        },
      };

      mockSheets.spreadsheets.values.get.mockResolvedValue(mockResponse);

      await getGuestData();

      expect(getGSheetCredentials).toHaveBeenCalled();
      expect(google.auth.JWT).toHaveBeenCalledWith({
        email: 'test@example.com',
        key: 'mock-private-key',
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      expect(google.sheets).toHaveBeenCalledWith({ version: 'v4', auth: mockAuth });
    });

    test('should call Google Sheets API with correct parameters', async () => {
      const mockResponse = {
        data: {
          values: [
            ['firstName'],
            ['John'],
          ],
        },
      };

      mockSheets.spreadsheets.values.get.mockResolvedValue(mockResponse);

      await getGuestData();

      expect(mockSheets.spreadsheets.values.get).toHaveBeenCalledWith({
        spreadsheetId: 'mock-spreadsheet-id',
        range: 'rsvped-guests-formatted!A1:Z150',
      });
    });

    test('should handle missing columns (empty cells)', async () => {
      const mockResponse = {
        data: {
          values: [
            ['firstName', 'lastName', 'phoneNumber'],
            ['John', 'Doe', '+15551234567'],
            ['Jane', '', ''], // Missing lastName and phoneNumber
          ],
        },
      };

      mockSheets.spreadsheets.values.get.mockResolvedValue(mockResponse);

      const result = await getGuestData();

      expect(result).toHaveLength(2);
      expect(result[1]).toEqual({
        firstName: 'Jane',
        lastName: '',
        phoneNumber: '',
      });
    });

    test('should handle rows with different lengths', async () => {
      const mockResponse = {
        data: {
          values: [
            ['firstName', 'lastName', 'phoneNumber', 'shouldReceiveSMS'],
            ['John', 'Doe', '+15551234567', 'TRUE'],
            ['Jane', 'Smith'], // Shorter row
          ],
        },
      };

      mockSheets.spreadsheets.values.get.mockResolvedValue(mockResponse);

      const result = await getGuestData();

      expect(result).toHaveLength(2);
      expect(result[1]).toEqual({
        firstName: 'Jane',
        lastName: 'Smith',
        phoneNumber: '',
        shouldReceiveSMS: '',
      });
    });

    test('should filter out empty rows', async () => {
      const mockResponse = {
        data: {
          values: [
            ['firstName', 'phoneNumber'],
            ['John', '+15551234567'],
            null, // Empty row
            ['Jane', '+15551234568'],
          ],
        },
      };

      mockSheets.spreadsheets.values.get.mockResolvedValue(mockResponse);

      const result = await getGuestData();

      expect(result).toHaveLength(2);
      expect(result[0].firstName).toBe('John');
      expect(result[1].firstName).toBe('Jane');
    });

    test('should throw error if no data found in spreadsheet', async () => {
      const mockResponse = {
        data: {
          values: [],
        },
      };

      mockSheets.spreadsheets.values.get.mockResolvedValue(mockResponse);

      await expect(getGuestData()).rejects.toThrow('No data found in spreadsheet');
    });

    test('should throw error if response is null', async () => {
      mockSheets.spreadsheets.values.get.mockResolvedValue(null);

      await expect(getGuestData()).rejects.toThrow('No data found in spreadsheet');
    });

    test('should handle Google Sheets API errors', async () => {
      mockSheets.spreadsheets.values.get.mockRejectedValue(new Error('API Error'));

      await expect(getGuestData()).rejects.toThrow('API Error');
    });

    test('should handle missing credentials', async () => {
      getGSheetCredentials.mockResolvedValue({
        gClientEmail: null,
        gPrivateKey: null,
        gSpreadSheetId: null,
      });

      await expect(getGuestData()).rejects.toThrow('Missing required Google Sheets credentials');
    });

    test('should handle authentication errors', async () => {
      getGSheetCredentials.mockRejectedValue(new Error('Authentication failed'));

      await expect(getGuestData()).rejects.toThrow('Authentication failed');
    });
  });

  describe('updateSmsPreference', () => {
    beforeEach(() => {
      // Mock the initial get call for finding the row
      const mockGetResponse = {
        data: {
          values: [
            ['firstName', 'phoneNumber', 'shouldReceiveSMS'],
            ['John', '+15551234567', 'TRUE'],
            ['Jane', '+15551234568', 'FALSE'],
          ],
        },
      };

      mockSheets.spreadsheets.values.get.mockResolvedValue(mockGetResponse);
      mockSheets.spreadsheets.values.update.mockResolvedValue({ data: {} });
    });

    test('should update SMS preference to FALSE when user opts out', async () => {
      const result = await updateSmsPreference('+15551234567', false);

      expect(result).toBe(true);
      expect(mockSheets.spreadsheets.values.update).toHaveBeenCalledWith({
        spreadsheetId: 'mock-spreadsheet-id',
        range: 'rsvped-guests-formatted!C2', // Column C (shouldReceiveSMS), Row 2
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [['FALSE']],
        },
      });
    });

    test('should update SMS preference to TRUE when user opts in', async () => {
      const result = await updateSmsPreference('+15551234568', true);

      expect(result).toBe(true);
      expect(mockSheets.spreadsheets.values.update).toHaveBeenCalledWith({
        spreadsheetId: 'mock-spreadsheet-id',
        range: 'rsvped-guests-formatted!C3', // Column C (shouldReceiveSMS), Row 3
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [['TRUE']],
        },
      });
    });

    test('should find correct row by phone number', async () => {
      await updateSmsPreference('+15551234568', false);

      expect(mockSheets.spreadsheets.values.update).toHaveBeenCalledWith(
        expect.objectContaining({
          range: 'rsvped-guests-formatted!C3', // Row 3 for Jane
        })
      );
    });

    test('should return false if phone number not found', async () => {
      const result = await updateSmsPreference('+15559999999', false);

      expect(result).toBe(false);
      expect(mockSheets.spreadsheets.values.update).not.toHaveBeenCalled();
    });

    test('should return false if phone number column not found', async () => {
      const mockGetResponse = {
        data: {
          values: [
            ['firstName', 'lastName', 'shouldReceiveSMS'], // No phoneNumber column
            ['John', 'Doe', 'TRUE'],
          ],
        },
      };

      mockSheets.spreadsheets.values.get.mockResolvedValue(mockGetResponse);

      const result = await updateSmsPreference('+15551234567', false);

      expect(result).toBe(false);
      expect(mockSheets.spreadsheets.values.update).not.toHaveBeenCalled();
    });

    test('should return false if shouldReceiveSMS column not found', async () => {
      const mockGetResponse = {
        data: {
          values: [
            ['firstName', 'phoneNumber', 'email'], // No shouldReceiveSMS column
            ['John', '+15551234567', 'john@example.com'],
          ],
        },
      };

      mockSheets.spreadsheets.values.get.mockResolvedValue(mockGetResponse);

      const result = await updateSmsPreference('+15551234567', false);

      expect(result).toBe(false);
      expect(mockSheets.spreadsheets.values.update).not.toHaveBeenCalled();
    });

    test('should handle phone column with case variations', async () => {
      const mockGetResponse = {
        data: {
          values: [
            ['firstName', 'PhoneNumber', 'shouldReceiveSMS'], // Capital P
            ['John', '+15551234567', 'TRUE'],
          ],
        },
      };

      mockSheets.spreadsheets.values.get.mockResolvedValue(mockGetResponse);

      const result = await updateSmsPreference('+15551234567', false);

      expect(result).toBe(true);
    });

    test('should handle shouldReceiveSMS column variations', async () => {
      const mockGetResponse = {
        data: {
          values: [
            ['firstName', 'phoneNumber', 'ShouldReceiveSM'], // Alternate spelling
            ['John', '+15551234567', 'TRUE'],
          ],
        },
      };

      mockSheets.spreadsheets.values.get.mockResolvedValue(mockGetResponse);

      const result = await updateSmsPreference('+15551234567', false);

      expect(result).toBe(true);
    });

    test('should handle update API errors gracefully', async () => {
      mockSheets.spreadsheets.values.update.mockRejectedValue(new Error('Update failed'));

      const result = await updateSmsPreference('+15551234567', false);

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    test('should handle empty spreadsheet', async () => {
      const mockGetResponse = {
        data: {
          values: [],
        },
      };

      mockSheets.spreadsheets.values.get.mockResolvedValue(mockGetResponse);

      const result = await updateSmsPreference('+15551234567', false);

      expect(result).toBe(false);
    });

    test('should calculate correct cell range for different columns', async () => {
      const mockGetResponse = {
        data: {
          values: [
            ['firstName', 'lastName', 'phoneNumber', 'email', 'shouldReceiveSMS'], // Column E (index 4)
            ['John', 'Doe', '+15551234567', 'john@example.com', 'TRUE'],
          ],
        },
      };

      mockSheets.spreadsheets.values.get.mockResolvedValue(mockGetResponse);

      await updateSmsPreference('+15551234567', false);

      expect(mockSheets.spreadsheets.values.update).toHaveBeenCalledWith(
        expect.objectContaining({
          range: 'rsvped-guests-formatted!E2', // Column E (65 + 4 = 69 = 'E')
        })
      );
    });
  });

  describe('Real World Scenarios', () => {
    test('should handle typical guest list with all fields', async () => {
      const mockResponse = {
        data: {
          values: [
            ['firstName', 'lastName', 'phoneNumber', 'shouldReceiveSMS', 'isAdmin', 'rsvp', 'party'],
            ['John', 'Doe', '+15551234567', 'TRUE', 'FALSE', 'accept', 'john-party'],
            ['Jane', 'Smith', '+15551234568', 'TRUE', 'TRUE', 'accept', 'jane-party'],
            ['Bob', 'Wilson', '+15551234569', 'FALSE', 'FALSE', 'decline', 'bob-party'],
          ],
        },
      };

      mockSheets.spreadsheets.values.get.mockResolvedValue(mockResponse);

      const result = await getGuestData();

      expect(result).toHaveLength(3);
      expect(result[0].rsvp).toBe('accept');
      expect(result[2].shouldReceiveSMS).toBe('FALSE');
    });

    test('should handle guest opting out via STOP command', async () => {
      const mockGetResponse = {
        data: {
          values: [
            ['firstName', 'phoneNumber', 'shouldReceiveSMS'],
            ['John', '+15551234567', 'TRUE'],
          ],
        },
      };

      mockSheets.spreadsheets.values.get.mockResolvedValue(mockGetResponse);
      mockSheets.spreadsheets.values.update.mockResolvedValue({ data: {} });

      const result = await updateSmsPreference('+15551234567', false);

      expect(result).toBe(true);
      expect(mockSheets.spreadsheets.values.update).toHaveBeenCalledWith(
        expect.objectContaining({
          resource: {
            values: [['FALSE']],
          },
        })
      );
    });

    test('should handle large guest list', async () => {
      const headers = ['firstName', 'phoneNumber', 'shouldReceiveSMS'];
      const rows = [headers];

      // Add 100 guests
      for (let i = 1; i <= 100; i++) {
        rows.push([`Guest${i}`, `+1555123${i.toString().padStart(4, '0')}`, 'TRUE']);
      }

      const mockResponse = {
        data: {
          values: rows,
        },
      };

      mockSheets.spreadsheets.values.get.mockResolvedValue(mockResponse);

      const result = await getGuestData();

      expect(result).toHaveLength(100);
      expect(result[0].firstName).toBe('Guest1');
      expect(result[99].firstName).toBe('Guest100');
    });
  });

  describe('Error Recovery', () => {
    test('should provide helpful error message when credentials are invalid', async () => {
      getGSheetCredentials.mockResolvedValue({
        gClientEmail: '',
        gPrivateKey: '',
        gSpreadSheetId: '',
      });

      await expect(getGuestData()).rejects.toThrow('Missing required Google Sheets credentials');
    });

    test('should handle network errors gracefully', async () => {
      mockSheets.spreadsheets.values.get.mockRejectedValue(new Error('Network timeout'));

      await expect(getGuestData()).rejects.toThrow('Network timeout');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error reading from Google Sheets:',
        expect.any(Error)
      );
    });

    test('should handle permission errors', async () => {
      mockSheets.spreadsheets.values.get.mockRejectedValue(new Error('Permission denied'));

      await expect(getGuestData()).rejects.toThrow('Permission denied');
    });

    test('should return false on update errors instead of throwing', async () => {
      const mockGetResponse = {
        data: {
          values: [
            ['firstName', 'phoneNumber', 'shouldReceiveSMS'],
            ['John', '+15551234567', 'TRUE'],
          ],
        },
      };

      mockSheets.spreadsheets.values.get.mockResolvedValue(mockGetResponse);
      mockSheets.spreadsheets.values.update.mockRejectedValue(new Error('Permission denied'));

      const result = await updateSmsPreference('+15551234567', false);

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });
});

const { google } = require("googleapis");
const { getGSheetCredentials } = require("./getCredentials");

const sheetName = "rsvped-guests-formatted"; // #todo: make dynamic
const range = "A1:Z150";

// Initialize Google Sheets authentication and get sheets API
const initializeSheets = async () => {
  try {
    const credentials = await getGSheetCredentials();
    const { gClientEmail, gPrivateKey, gSpreadSheetId } = credentials || {};

    // Add validation
    if (!gClientEmail || !gPrivateKey || !gSpreadSheetId) {
      throw new Error("Missing required Google Sheets credentials");
    }

    const auth = new google.auth.JWT({
      email: gClientEmail,
      key: gPrivateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    return { sheets, spreadsheetId: gSpreadSheetId };
  } catch (error) {
    console.error("Error initializing Google Sheets:", error);
    throw error;
  }
};

// Get all guest data from Google Sheets
const getGuestData = async () => {
  try {
    const { sheets, spreadsheetId } = await initializeSheets();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!${range}`,
    });

    const rows = response?.data?.values || [];

    if (!rows || rows.length === 0) {
      throw new Error("No data found in spreadsheet");
    }

    // Convert to object
    const headers = rows[0];
    const data = rows.slice(1).map((row) => {
      const guest = {};
      headers.forEach((header, index) => {
        guest[header] = row[index] || "";
      });
      return guest;
    });

    // Return all data (filtering will be done in getTargetNumbers)
    return data.filter(Boolean);
  } catch (error) {
    console.error("Error reading from Google Sheets:", error);
    throw error;
  }
};

// Update SMS preference for a specific phone number
const updateSmsPreference = async (phoneNumber, shouldReceiveSms) => {
  try {
    const { sheets, spreadsheetId } = await initializeSheets();

    // First, get the current data to find the row
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!${range}`,
    });

    const rows = response?.data?.values || [];
    if (!rows || rows.length === 0) {
      throw new Error("No data found in spreadsheet");
    }

    const headers = rows[0];
    const phoneColIndex = headers.findIndex((h) => h && h.toLowerCase().includes("phone"));
    const smsColIndex = headers.findIndex(
      (h) => h && (h.toLowerCase().includes("shouldreceivesms") || h.toLowerCase().includes("shouldreceivesm"))
    );

    if (phoneColIndex === -1) {
      console.error("Phone number column not found");
      return false;
    }

    if (smsColIndex === -1) {
      console.error("shouldReceiveSMS column not found");
      return false;
    }

    // Find the row with matching phone number
    let targetRowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][phoneColIndex] === phoneNumber) {
        targetRowIndex = i;
        break;
      }
    }

    if (targetRowIndex === -1) {
      console.error(`Phone number ${phoneNumber} not found in sheet`);
      return false;
    }

    // Update the specific cell
    const cellRange = `${sheetName}!${String.fromCharCode(65 + smsColIndex)}${targetRowIndex + 1}`;
    const cellValue = shouldReceiveSms ? "TRUE" : "FALSE";

    console.log(`Updating cell ${cellRange} with value: "${cellValue}"`);

    const updateResult = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: cellRange,
      valueInputOption: "USER_ENTERED", // Changed from RAW to USER_ENTERED
      resource: {
        values: [[cellValue]],
      },
    });

    console.log(`Update result:`, updateResult.data);
    console.log(`Updated SMS preference for ${phoneNumber} to ${shouldReceiveSms} (cell value: ${cellValue})`);
    return true;
  } catch (error) {
    console.error("Error updating SMS preference:", error);
    return false;
  }
};

// Update RSVP status for a specific phone number
const updateRsvpStatus = async (phoneNumber, rsvpStatus) => {
  try {
    const { sheets, spreadsheetId } = await initializeSheets();

    // First, get the current data to find the row
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!${range}`,
    });

    const rows = response?.data?.values || [];
    if (!rows || rows.length === 0) {
      throw new Error("No data found in spreadsheet");
    }

    const headers = rows[0];
    const phoneColIndex = headers.findIndex((h) => h && h.toLowerCase().includes("phone"));
    const rsvpColIndex = headers.findIndex((h) => h && h.toLowerCase().includes("rsvp"));

    if (phoneColIndex === -1 || rsvpColIndex === -1) {
      console.error("Required columns not found");
      return false;
    }

    // Find the row with matching phone number
    let targetRowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][phoneColIndex] === phoneNumber) {
        targetRowIndex = i;
        break;
      }
    }

    if (targetRowIndex === -1) {
      console.error(`Phone number ${phoneNumber} not found in sheet`);
      return false;
    }

    // Update the specific cell
    const cellRange = `${sheetName}!${String.fromCharCode(65 + rsvpColIndex)}${targetRowIndex + 1}`;
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: cellRange,
      valueInputOption: "RAW",
      resource: {
        values: [[rsvpStatus]],
      },
    });

    console.log(`Updated RSVP for ${phoneNumber} to ${rsvpStatus}`);
    return true;
  } catch (error) {
    console.error("Error updating RSVP status:", error);
    return false;
  }
};

module.exports = {
  getGuestData,
  updateSmsPreference,
  updateRsvpStatus,
};

const { google } = require("googleapis");
const { getGSheetCredentials } = require("./getCredentials");
const { log } = require("./utils");

const sheetName = "rsvped-guests-formatted"; // #TODO: make this dynamic or get from env
const range = "A1:Z150";

const initializeSheets = async () => {
  try {
    const { gClientEmail, gPrivateKey, gSpreadSheetId } = await getGSheetCredentials();

    if (!gClientEmail || !gPrivateKey || !gSpreadSheetId) throw new Error("Missing required Google Sheets credentials");

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

const getGuestData = async () => {
  try {
    const { sheets, spreadsheetId } = await initializeSheets();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!${range}`,
    });

    const rows = response?.data?.values || [];

    if (!rows?.length) throw new Error("No data found in spreadsheet");

    const headers = rows[0];
    const data = rows.slice(1).map((row) => {
      const guest = {};
      headers.forEach((header, index) => {
        guest[header] = row[index] || "";
      });
      return guest;
    });

    return data.filter(Boolean);
  } catch (error) {
    console.error("Error reading from Google Sheets:", error);
    throw error;
  }
};

const updateSmsPreference = async (phoneNumber, shouldReceiveSms) => {
  try {
    const { sheets, spreadsheetId } = await initializeSheets();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!${range}`,
    });

    const rows = response?.data?.values || [];

    if (!rows?.length) throw new Error("No data found in spreadsheet");

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

    const cellRange = `${sheetName}!${String.fromCharCode(65 + smsColIndex)}${targetRowIndex + 1}`;
    const cellValue = shouldReceiveSms ? "TRUE" : "FALSE";

    log(`Updating cell ${cellRange} with value: "${cellValue}"`);

    const updateResult = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: cellRange,
      valueInputOption: "USER_ENTERED",
      resource: {
        values: [[cellValue]],
      },
    });

    log(`Update result:`, updateResult.data);
    log(`Updated SMS preference for ${phoneNumber} to ${shouldReceiveSms} (cell value: ${cellValue})`);

    return true;
  } catch (error) {
    console.error("Error updating SMS preference:", error);
    return false;
  }
};

module.exports = {
  getGuestData,
  updateSmsPreference,
};

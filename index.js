const fs = require("fs").promises;
const path = require("path");
const Papa = require("papaparse");

const handler = async () => {
  try {
    // Read the CSV file
    const csvFilePath = path.join(__dirname, "guest-list-all.csv");
    const csvContent = await fs.readFile(csvFilePath, "utf8");
    const data = Papa.parse(csvContent, { header: true }).data || [];
    const csv = data.map((guest) => {
      const email = guest["email"];
      const firstName = guest["first name"];
      const phoneNumber = guest["phone number"];
      const party = guest["party"] || "";
      const rsvp = guest["rsvp"] || "";
      const hasResponded = rsvp !== "";

      return {
        email,
        firstName,
        phoneNumber,
        party,
        rsvp,
        hasResponded,
      };
    });

    const categorizeGuests = (guests) => {
      const categories = { notResponded: [], declined: [], rsvped: [] };

      guests.forEach((guest) => {
        const rsvp = (guest.rsvp || "").toLowerCase();
        if (rsvp === "") categories.notResponded.push(guest);
        else if (rsvp.includes("decline")) categories.declined.push(guest);
        else if (rsvp.includes("accept")) categories.rsvped.push(guest);
      });

      return categories;
    };

    const { notResponded, declined, rsvped } = categorizeGuests(csv);

    console.log(`Not Responded: ${notResponded.length}`);
    console.log(`Declined: ${declined.length}`);
    console.log(`RSVPed: ${rsvped.length}`);

    const partiesByName = rsvped.reduce((acc, guest) => {
      const partyName = guest.party || `solo_${guest.firstName}`; // unique key for solo guests

      if (!acc[partyName]) {
        acc[partyName] = [];
      }

      acc[partyName].push(guest);

      return acc;
    }, {});

    // If any member of a party is missing a phone number, consolidate the party into a single entry with combined names
    const consolidatedRsvps = Object.values(partiesByName).flatMap((partyMembers) => {
      const hasMissingPhone = partyMembers.some((g) => !g.phoneNumber);

      if (!hasMissingPhone) return partyMembers;

      const mainContact = partyMembers.find((g) => g.phoneNumber) || partyMembers[0];
      const allNames = partyMembers.map((g) => g.firstName).join(" & ");

      return [
        {
          ...mainContact,
          firstName: allNames,
          partySize: partyMembers.length,
        },
      ];
    });

    const csvOutput = Papa.unparse(consolidatedRsvps);
    const outputFilePath = path.join(__dirname, "rsvped-guests-formatted.csv");

    await fs.writeFile(outputFilePath, csvOutput);
  } catch (error) {
    console.error("Error reading or parsing CSV file:", error);
  }
};

handler();

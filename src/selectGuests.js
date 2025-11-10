const { log } = require("./utils");

const cleanPhoneNumber = (phone) => phone.replace(/[\s\-()]/g, "");
const isPhoneNumber = (str) => /^[+]?[1-9][\d\-() \s]+$/.test(str);

const getSmsEnabledGuests = (guestData) =>
  guestData.filter(
    (guest) => guest.phoneNumber && (guest.shouldReceiveSMS === "TRUE" || guest.shouldReceiveSMS === true)
  );

const selectGuests = async (guestData, alias) => {
  const aliasLower = alias.toLowerCase();
  const smsEnabledGuests = getSmsEnabledGuests(guestData);

  if (aliasLower === "all") {
    return smsEnabledGuests;

  } else if (aliasLower === "rsvped") {
    const filtered = smsEnabledGuests.filter(
      (g) => g.rsvp && g.rsvp.toLowerCase().includes("accept")
    );
    return filtered;

  } else if (aliasLower === "notresponded") {
    const filtered = smsEnabledGuests.filter((g) => !g.rsvp || g.rsvp.trim() === "");
    return filtered;

  } else if (aliasLower === "declined") {
    const filtered = smsEnabledGuests.filter(
      (g) => g.rsvp && g.rsvp.toLowerCase().includes("decline")
    );
    return filtered;

  } else if (["family1", "family2", "friends"].includes(aliasLower)) {
    const columnName = `is${alias.charAt(0).toUpperCase() + alias.slice(1)}`;
    const filtered = smsEnabledGuests.filter((g) => g[columnName] === "TRUE" || g[columnName] === true);
    return filtered;

  } else if (isPhoneNumber(alias)) {
    const cleaned = cleanPhoneNumber(alias);
    const guest = smsEnabledGuests.find((g) => cleanPhoneNumber(g.phoneNumber) === cleaned);
    if (!guest) {
      log(`No guest found for phone number ${alias}`);
      return [];
    }
    return [guest];
  }

  // Name match (first, last, or full)
  const lower = aliasLower;
  const nameMatches = smsEnabledGuests.filter(
    (g) =>
      (g.firstName && g.firstName.toLowerCase() === lower) ||
      (g.lastName && g.lastName.toLowerCase() === lower) ||
      (g.firstName && g.lastName && `${g.firstName} ${g.lastName}`.toLowerCase() === lower)
  );
  if (nameMatches.length > 0) return nameMatches;

  // Party match
  const partyMatches = smsEnabledGuests.filter((g) => g.party && g.party.toLowerCase() === lower);
  if (partyMatches.length > 0) return partyMatches;

  log(`No recipients found for target "${alias}"`);
  return [];
};

module.exports = { selectGuests };



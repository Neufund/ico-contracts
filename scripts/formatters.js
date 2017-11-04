// eslint-disable-next-line
const BigNumber = require("bignumber.js");
const moment = require("moment");

// these functions are tested in commitemnt project
// keep them in sync

export function bignumberToString(bignumberString) {
  const parts = bignumberString.split("e+");
  // no scientific notation, just return it
  if (parts.length === 1) {
    return bignumberString;
  }
  const first = parts[0].replace(".", "");
  const zeroes = parseInt(parts[1], 10) - (first.length - 1);

  return first + "0".repeat(zeroes);
}

export function formatMoney(decimals, moneyInULP) {
  const moneyInPrimaryBase = moneyInULP.div(new BigNumber(10).pow(decimals));
  return moneyInPrimaryBase.toFixed(4);
}

export function formatDate(dateAsBigNumber) {
  // we can't use here instanceof because it can be created by different constructor
  if (dateAsBigNumber.constructor.name !== "BigNumber") {
    throw new Error("Date has to be bignumber instance!");
  }

  const date = moment.utc(dateAsBigNumber.toNumber(), "X");
  return formatMomentDate(date);
}

export function formatMomentDate(date) {
  if (!(date instanceof moment)) {
    throw new Error("Date has to be momentjs instance!");
  }

  return date.format("YYYY-MM-DD hh:mm UTC");
}

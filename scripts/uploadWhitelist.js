/* eslint-disable no-console */

// eslint-disable-next-line import/no-extraneous-dependencies
require("babel-register");
const d3 = require("d3-dsv");
const fs = require("fs");
const path = require("path");

const Commitment = artifacts.require("Commitment");

const tokenEnum = {
  EUR: 2,
  ETH: 1
};

const Q18 = new web3.BigNumber(10).pow(18);

const isAddress = address => {
  if (!web3.isAddress(address))
    throw new Error(
      `Investor with Address:${address} has wrong address format!!`
    );
  return address;
};
const isCurrency = (currency, address) => {
  if (currency !== "EUR" && currency !== "ETH")
    throw new Error(
      `Investor:${address} and currency:${currency} has wrong currency format!!`
    );
  return tokenEnum[currency];
};
const getAmount = (amount, address) => {
  const investAmount = Number.parseFloat(amount.replace(/^\D+/g, ""));
  // Most of the case this is for an empty string ""
  if (Number.isNaN(investAmount))
    throw new Error(`Investor ${address} has their amount left out`);
  return investAmount === 0 ? new web3.BigNumber(0) : Q18.mul(investAmount);
};

const getAttributes = (address, currency, amount) => ({
  wlAddresses: isAddress(address),
  wlTokens: isCurrency(currency, address),
  wlTickets: getAmount(amount, address)
});
const isDuplicate = array => {
  const duplicateArray = array.filter(
    data =>
      array.filter(investor => {
        if (investor.wlAddresses === data.wlAddresses) return true;
        return undefined;
      }).length > 1
  );
  if (duplicateArray.length > 0) {
    console.log("You your duplicate object");
    console.log(duplicateArray);
    throw new Error("You have a duplications");
  }
};
const getList = () => {
  const filepath = path.resolve("./scripts/whitelist2.csv");
  console.log("Loading CSV file and parsing");
  const parsedCsv = d3.csvParse(fs.readFileSync(filepath, "UTF-8"));
  console.log("Filtering CSV");
  const filteredWhiteList = parsedCsv
    .map(investor => {
      if (investor["Ethereum Public Address"]) {
        return getAttributes(investor["Ethereum Public Address"], "ETH", "0");
      }
      if (investor["Public Address"]) {
        return getAttributes(
          investor["Public Address"],
          investor.Currency,
          investor.Currency === "ETH"
            ? investor["Amount in ETH"]
            : investor["Amount in EUR"]
        );
      }
      return undefined;
    })
    .filter(investor => !!investor);
  console.log("Checking for duplications");
  isDuplicate(filteredWhiteList);
  console.log("Formating");
  return Object.keys(filteredWhiteList[0]).map(v => ({
    [v]: filteredWhiteList.map(c => c[v])
  }));
};
module.exports = async function prefillAgreements() {
  try {
    const commitment = await Commitment.deployed();
    const formattedWhiteList = getList();
  } catch (e) {
    console.log(e);
  }
};

/* eslint-disable no-console */

// eslint-disable-next-line import/no-extraneous-dependencies
require("babel-register");
const d3 = require("d3-dsv");
const fs = require("fs");
const confirm = require("node-ask").confirm;
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
  // Most of the case this is for an empty string
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
const filterWlfromSmartContract = async (filteredWhiteList, commitment) => {
  let lastUploadedfile = false;
  const verifiedWhiteList = (await Promise.all(
    filteredWhiteList.map(async investor => {
      const whiteListTicketbyAddress = await commitment.whitelistTicket(
        investor.wlAddresses
      );
      const tokenType = whiteListTicketbyAddress[0].isZero();
      const ticketSize = whiteListTicketbyAddress[1].toString();
      const ticketSizefromList =
        investor.wlTokens === 1
          ? (await commitment.convertToEur(investor.wlTickets)).toString()
          : investor.wlTickets.toString();

      if (ticketSize !== ticketSizefromList && tokenType === false) {
        throw new Error(
          `Ticket size in Smart contract is not correct ${ticketSize} ${
            ticketSizefromList
          } token ${tokenType} for ${investor.wlAddresses}`
        );
      }
      return tokenType ? investor : undefined;
    })
  )).filter(investor => {
    if (investor !== undefined) {
      lastUploadedfile = true;
    }
    if (investor === undefined) {
      if (lastUploadedfile === true)
        throw new Error("Something went really wrong with the smart contracts");
    }
    return !!investor;
  });
  if (verifiedWhiteList.length === 0)
    throw new Error(
      "All address indicated in whitelist are already added into SmartContract"
    );
  return verifiedWhiteList;
};
const getList = async filePath => {
  console.log("Loading CSV file and parsing");
  const parsedCsv = d3.csvParse(fs.readFileSync(filePath, "UTF-8"));
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
  return filteredWhiteList;
};
const formatPayload = payload =>
  Object.keys(payload[0]).map(v => ({
    [v]: payload.map(c => c[v])
  }));
module.exports = async function uploadWhitelist() {
  const [
    csvFile,
    CommitmentAddress,
    payloadSize,
    ...other
  ] = process.argv.slice(6);
  if (other.length) throw new Error("To many variables");
  try {
    const commitment = await Commitment.at(CommitmentAddress);
    console.log(path.resolve(csvFile));
    const formattedWhiteList = await getList(path.resolve(csvFile));
    let verifiedWhiteList;
    console.log("Comparing list with Smart Contract Whitelist and filtering");
    verifiedWhiteList = await filterWlfromSmartContract(
      formattedWhiteList,
      commitment
    );
    do {
      const whitelistPayloud = verifiedWhiteList.slice(0, payloadSize);
      verifiedWhiteList = verifiedWhiteList.slice(
        payloadSize,
        verifiedWhiteList.length
      );

      console.log("Setting whitelist Payloud");
      const formattedPayload = formatPayload(whitelistPayloud);
      console.log("Sending Payload to SmartContract");
      const transactionReceipt = (await commitment.addWhitelisted(
        formattedPayload[0].wlAddresses,
        formattedPayload[1].wlTokens,
        formattedPayload[2].wlTickets
      )).receipt;
      if ((await transactionReceipt.status) === 0)
        throw new Error("Transaction didn't go through check connection");
      else {
        console.log("Transaction passed These addresses were added");
        console.log(formattedPayload[0].wlAddresses);
        console.log(`receipt:${JSON.stringify(transactionReceipt, null, 1)}`);
      }
      if (
        !await confirm("Do you want to continue uploading whitelist? [y/n] ")
      ) {
        throw new Error("Aborting!");
      }
    } while (verifiedWhiteList.length > 0);
  } catch (e) {
    console.log(e);
  }
};

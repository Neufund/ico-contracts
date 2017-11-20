/* eslint-disable no-console */

// eslint-disable-next-line import/no-extraneous-dependencies
require("babel-register");
const d3 = require("d3-dsv");
const fs = require("fs");
// const confirm = require("node-ask").confirm;
const path = require("path");

const Commitment = artifacts.require("Commitment");

const tokenEnum = {
  EUR: 2,
  ETH: 1
};

const Q18 = new web3.BigNumber(10).pow(18);

const isAddress = address => {
  const addressTrimmed = address.trim();
  if (!web3.isAddress(addressTrimmed))
    throw new Error(
      `Investor with Address:${address} has wrong address format!!`
    );
  return addressTrimmed;
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
  wlAddresses: address,
  wlTokens: currency,
  wlTickets: amount
});

const removeDuplicates = array => {
  const cleanedArray = [];
  for (const investor of array) {
    if (
      !cleanedArray.some(
        i => investor.wlAddresses.toLowerCase() === i.wlAddresses.toLowerCase()
      )
    ) {
      cleanedArray.push(investor);
    } else {
      if (investor.wlTickets > 0) {
        throw new Error(
          `Duplicate for investor with reserved ticket ${investor.wlAddresses}`
        );
      }
      console.log(investor);
    }
  }

  return cleanedArray;
};

const filterWlfromSmartContract = async (filteredWhiteList, commitment) => {
  const verifiedWhiteList = [];

  let index = 0;
  for (const investor of filteredWhiteList) {
    const whiteListTicketbyAddress = await commitment.whitelistTicket(
      investor.wlAddresses
    );

    const tokenType = whiteListTicketbyAddress[0].toNumber();

    if (tokenType !== 0) {
      if (tokenType !== investor.wlTokens) {
        throw new Error(
          `Token type in contract is not correct ${tokenType} ${
            investor.wlTokens
          } for ${investor.wlAddresses}`
        );
      }

      const ticketSize = whiteListTicketbyAddress[1];
      const ticketSizefromList =
        investor.wlTokens === 1
          ? await commitment.convertToEur(investor.wlTickets)
          : investor.wlTickets;
      if (!ticketSize.eq(ticketSizefromList)) {
        throw new Error(
          `Ticket size in Smart contract is not correct ${ticketSize} ${
            ticketSizefromList
          } token ${tokenType} for ${investor.wlAddresses}`
        );
      }

      try {
        const commitmentAddressBasedonIndex = await commitment.whitelistInvestor(
          index
        );
        console.log(commitmentAddressBasedonIndex);
        console.log(investor.wlAddresses);
        console.log(index);
        if (
          commitmentAddressBasedonIndex.toLowerCase() !==
          investor.wlAddresses.toLowerCase()
        ) {
          throw new Error("List is not ordered");
        }
      } catch (err) {
        console.log(
          `cannot get investor for index ${index} ${investor.wlAddresses}`
        );
        console.log(whiteListTicketbyAddress);
        console.log(err);
        throw err;
      }
    } else {
      verifiedWhiteList.push(investor);
    }
    index += 1;
  }

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
      if (investor["Public Address"]) {
        const investorAddress = isAddress(investor["Public Address"]);
        const investorCurrency = isCurrency(investor.Currency, investorAddress);
        const amountEth = getAmount(investor["Amount in ETH"]);
        const amountEur = getAmount(investor["Amount in EUR"]);
        if (
          investorCurrency === tokenEnum.EUR &&
          (amountEur.lt(Q18.mul(290)) && !amountEur.eq(0))
        ) {
          throw new Error(
            `minumum ticket for ${investorAddress} in EUR not met`
          );
        }
        if (
          investorCurrency === tokenEnum.ETH &&
          (amountEth.lt(Q18) && !amountEth.eq(0))
        ) {
          throw new Error(
            `minumum ticket for ${investorAddress} in ETH not met`
          );
        }
        return getAttributes(
          investorAddress,
          investorCurrency,
          investorCurrency === tokenEnum.EUR ? amountEur : amountEth
        );
      }
      console.log(investor);
      throw new Error("Error in CSV file");
    })
    .filter(investor => !!investor);
  console.log("Checking for duplications");
  return removeDuplicates(filteredWhiteList);
};

const formatPayload = payload =>
  Object.keys(payload[0]).map(v => ({
    [v]: payload.map(c => c[v])
  }));

module.exports = async function uploadWhitelist() {
  const [csvFile, payloadSize, ...other] = process.argv.slice(6);
  // payloadSize = parseFloat(payloadSize);
  if (other.length) throw new Error("To many variables");
  try {
    const commitment = await Commitment.at(Commitment.address);
    console.log(path.resolve(csvFile));
    console.log(Commitment.address);
    const formattedWhiteList = await getList(path.resolve(csvFile));
    // console.log(formattedWhiteList);
    console.log("Comparing list with Smart Contract Whitelist and filtering");
    const verifiedWhiteList = await filterWlfromSmartContract(
      formattedWhiteList,
      commitment
    );

    let index = 0;
    const size = parseFloat(payloadSize);
    do {
      const endIndex =
        index + size >= verifiedWhiteList.length
          ? verifiedWhiteList.length
          : index + size;
      console.log(payloadSize);
      console.log(index);
      console.log(endIndex);
      const whitelistPayload = verifiedWhiteList.slice(index, endIndex);

      console.log("Setting whitelist Payload");
      const formattedPayload = formatPayload(whitelistPayload);
      console.log("Sending Payload to SmartContract");
      console.log(formattedPayload[0].wlAddresses);
      const transactionReceipt = await commitment.addWhitelisted(
        formattedPayload[0].wlAddresses,
        formattedPayload[1].wlTokens,
        formattedPayload[2].wlTickets
      );
      if (transactionReceipt.status === 0)
        throw new Error("Transaction didn't go through check connection");
      else {
        console.log(`receipt:${JSON.stringify(transactionReceipt, null, 1)}`);
        console.log("Transaction passed These addresses were added");
        console.log(formattedPayload[0].wlAddresses);
      }
      index += size;
      /* if (
        !await confirm("Do you want to continue uploading whitelist? [y/n] ")
      ) {
        throw new Error("Aborting!");
      } */
    } while (verifiedWhiteList.length > index);
  } catch (e) {
    console.log(e);
  }
};

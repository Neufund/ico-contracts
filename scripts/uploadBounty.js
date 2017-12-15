/* eslint-disable no-console */

// eslint-disable-next-line import/no-extraneous-dependencies
require("babel-register");
const d3 = require("d3-dsv");
const fs = require("fs");
// const confirm = require("node-ask").confirm;
const path = require("path");

const Neumark = artifacts.require("Neumark");
const Commitment = artifacts.require("Commitment");
const isListUnique = parsedBountyList => {
  const uniqueList = [];
  parsedBountyList.forEach(entry => {
    if (
      !uniqueList.some(
        uniqueAddress =>
          uniqueAddress.toLowerCase() === entry.address.toLowerCase()
      )
    ) {
      if (!web3.isAddress(entry.address))
        throw new Error(`${entry.address} is not an address`);
      uniqueList.push(entry.address);
    } else throw new Error(`You have a duplicate address ${entry.address}`);
  });
};
module.exports = async function uploadWhitelist() {
  const [csvFile, address, ...other] = process.argv.slice(6);
  try {
    if (other.length) throw new Error("To many arguments");
    const neumark = await Neumark.at(address);

    console.log(path.resolve(csvFile));
    console.log(Neumark.address);

    const parsedBountyList = d3.csvParse(
      fs.readFileSync(path.resolve(csvFile), "UTF-8")
    );
    isListUnique(parsedBountyList);
    if (!fs.existsSync("./bountyIndex"))
      fs.writeFileSync("./bountyIndex", JSON.stringify({ index: 0 }));

    let index = JSON.parse(fs.readFileSync("./bountyIndex")).index;
    do {
      // Todo: set token from flout to UINT254
      console.log(parsedBountyList[index].address);
      const transactionReceipt = await neumark.transfer(
        "0x5de139dbbfd47dd1d2cd906348fd1887135b2804",
        0
      );
      if (transactionReceipt.status === 0)
        throw new Error("Transaction failed");
      else {
        console.log(`receipt:${JSON.stringify(transactionReceipt, null, 1)}`);
        console.log("Transaction passed tokens sent to address");
        console.log(parsedBountyList[0].wlAddresses);
      }
      index += 1;
      fs.writeFileSync("./bountyIndex", JSON.stringify({ index }));
      /* if (
          !await confirm("Do you want to continue uploading whitelist? [y/n] ")
        ) {
          throw new Error("Aborting!");
        } */
    } while (parsedBountyList.length > index);
  } catch (e) {
    console.log(e);
  }
};

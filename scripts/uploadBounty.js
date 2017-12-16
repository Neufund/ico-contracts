/* eslint-disable no-console */

// eslint-disable-next-line import/no-extraneous-dependencies
require("babel-register");
const d3 = require("d3-dsv");
const fs = require("fs");
// const confirm = require("node-ask").confirm;
const path = require("path");

const Neumark = artifacts.require("Neumark");

const parseStrToNumStrict = source => {
  if (source === null) {
    return NaN;
  }
  if (source === undefined) {
    return NaN;
  }
  let transform = source.replace(/\s/g, "");
  transform = transform.replace(/,/g, ".");
  // we allow only digits dots and minus
  if (/[^.\-\d]/.test(transform)) {
    return NaN;
  }
  // we allow only one dot
  if ((transform.match(/\./g) || []).length > 1) {
    return NaN;
  }
  return parseFloat(transform);
};

const isListUnique = parsedBountyList => {
  const uniqueList = [];
  parsedBountyList.forEach(entry => {
    if (
      !uniqueList.some(
        uniqueAddress =>
          uniqueAddress.toLowerCase() === entry.address.toLowerCase()
      )
    ) {
      if (!Number.isInteger(parseStrToNumStrict(entry.neumark)))
        throw new Error("There was a problem with one of the inputs");
      if (!web3.isAddress(entry.address))
        throw new Error(`${entry.address} is not an address`);
      uniqueList.push(entry.address);
    } else throw new Error(`You have a duplicate address ${entry.address}`);
  });
};

module.exports = async function uploadBounty() {
  const [csvFile, address, inputIndex, ...other] = process.argv.slice(6);
  const startIndex = parseStrToNumStrict(inputIndex);
  let index = startIndex;
  try {
    if (other.length) throw new Error("To many arguments");
    if (!Number.isInteger(startIndex))
      throw new Error(
        `Index must be a number currently it is ${typeof startIndex}`
      );
    if (!web3.isAddress(address)) throw new Error("Wrong Neumark address");
    const neumark = await Neumark.at(address);

    console.log(`path:${path.resolve(csvFile)}`);
    console.log(`Neumark Address:${address}`);

    const parsedBountyList = d3.csvParse(
      fs.readFileSync(path.resolve(csvFile), "UTF-8")
    );
    console.log("Validating file");
    isListUnique(parsedBountyList);
    let total = new web3.BigNumber(0);
    do {
      const transactionReceipt = await neumark.transfer(
        parsedBountyList[index].address,
        new web3.BigNumber(parsedBountyList[index].neumark)
      );
      total = total.plus(new web3.BigNumber(parsedBountyList[index].neumark));
      if (transactionReceipt.status === 0)
        throw new Error(`Transaction failed`);
      else {
        console.log(`receipt:${JSON.stringify(transactionReceipt, null, 1)}`);
        console.log(
          `Transaction passed tokens sent to ${parsedBountyList[index].address}`
        );
        console.log(`Last successful index ${index}`);
        console.log(`total amount sent ${total.toString(10)}`);
      }
      index += 1;
      /* if (
          !await confirm("Do you want to continue uploading whitelist? [y/n] ")
        ) {
          throw new Error("Aborting!");
        } */
    } while (parsedBountyList.length > index);
  } catch (e) {
    console.log(e);
    console.log(`\n\n run: yarn truffle --network exec ./scripts/uploadBounty.js
    ${csvFile} ${address} ${index}\n\n`);
  }
};

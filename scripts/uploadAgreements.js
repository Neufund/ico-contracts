/* eslint-disable no-console */

// eslint-disable-next-line import/no-extraneous-dependencies
require("babel-register");
const ipfsAPI = require("ipfs-api");

// eslint-disable-next-line no-unused-vars
module.exports = async function(callback) {
  const ipfs = ipfsAPI("ipfs.neustg.net:5001");
  try {
    console.log(await ipfs.pin.ls());
  } catch (err) {
    console.log(err);
  }
};

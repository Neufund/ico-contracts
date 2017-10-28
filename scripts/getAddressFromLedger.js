/**
 * Simple script to get address from ledger using different derivation paths
 * usage: node ./scripts/getAddressFromLedger.js "44'/60'/0'/1" if you leave it empty you will get default path
 */

const ledger = require("ledgerco");
const TIMEOUT = 5 * 1000;
const DEFAULTPATH = "44'/60'/0'/0";
const comm = ledger.comm_node;

const path = process.argv[2] || DEFAULTPATH;
console.log("checking path:", path);

comm.create_async(TIMEOUT).then(function (comm) {
  const eth = new ledger.eth(comm);
  return eth.getAddress_async(path).then(function (result) {
    console.log(result);
    comm.close_async()
  })
});

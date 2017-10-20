const CommitmentContractDef = require("../build/contracts/Commitment.json");
const Web3 = require("web3");
const Promise = require("bluebird");

const networks = Object.keys(CommitmentContractDef.networks);
const crowdsaleContractAddress =
  CommitmentContractDef.networks[networks[0]].address;
const web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

const accounts = web3.eth.accounts.slice(0, -1);

const whitelistAdmin = accounts[0];

console.log("Using contract at ", crowdsaleContractAddress);
const Crowdsale = address => {
  const code = web3.eth.getCode(address);
  if (code === "0x0") {
    throw new Error("Contract is not deployed!");
  }

  return Promise.promisifyAll(
    web3.eth.contract(CommitmentContractDef.abi).at(address)
  );
};

async function whitelist(allAccounts) {
  console.log("Whitelisting: ", allAccounts);

  const accountsTickets = allAccounts.map(() => web3.toWei(20, "ether"));
  const accountsTokens = allAccounts.map(() => 1);
  const crowdsale = Crowdsale(crowdsaleContractAddress);
  return new Promise((resolve, reject) => {
    console.log(`Adding whitelisted. Length: ${allAccounts.length}`);

    try {
      console.log("Using account: ", whitelistAdmin);
      console.log("accountsTokens: ", accountsTokens);
      console.log("accountsTickets: ", accountsTickets);
      crowdsale.addWhitelisted(allAccounts, accountsTokens, accountsTickets, {
        from: whitelistAdmin,
        gas: 2000000
      });

      const confirmation = web3.eth.filter("latest", async error => {
        if (error) {
          reject(error);
        }
        confirmation.stopWatching();
        resolve();
      });
    } catch (e) {
      console.log("Contribution failed...", e);
      resolve();
    }
  });
}

async function main() {
  await whitelist(accounts);
  console.log("Whitelisting successful!");
}

main().catch(console.error);

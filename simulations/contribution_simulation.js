const CommitmentContractDef = require("../build/contracts/Commitment.json");
const Web3 = require("web3");
const Promise = require("bluebird");

const networks = Object.keys(CommitmentContractDef.networks);
const crowdsaleContractAddress =
  CommitmentContractDef.networks[networks[0]].address;
const web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

const accounts = web3.eth.accounts.slice(0, -1);

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

const CONTRIBUTION_VALUE_IN_ETHER = 2;
const CONTRIBUTION_VALUE_THETA = 0; // how much random each contribution can be
const DELAY_BETWEEN_CONTRIBUTIONS = 1000; // ms

async function contribute(from) {
  const crowdsale = Crowdsale(crowdsaleContractAddress);
  return new Promise((resolve, reject) => {
    const valueInEther =
      CONTRIBUTION_VALUE_IN_ETHER +
      (Math.random() - 0.5) * CONTRIBUTION_VALUE_THETA;
    console.log(`Contributing ${valueInEther} as ${from}`);

    const value = web3.toWei(valueInEther, "ether");
    try {
      crowdsale.commit.sendTransaction({ from, value, gas: 2000000 });

      const confirmation = web3.eth.filter("latest", async error => {
        if (error) {
          reject(error);
        }
        confirmation.stopWatching();
        console.log("SUCCESS!");
        resolve();
      });
    } catch (e) {
      console.log("Contribution failed...", e);
      resolve();
    }
  });
}

async function main() {
  for (const a of accounts.slice(3, -1)) {
    await contribute(a);
    await Promise.delay(DELAY_BETWEEN_CONTRIBUTIONS);
  }
}

main().catch(console.error);

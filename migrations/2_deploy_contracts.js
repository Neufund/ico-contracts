require("babel-register");
const controlAccounts = require("./accounts").default;

const RoleBasedAccessControl = artifacts.require("RoleBasedAccessControl");
const EthereumForkArbiter = artifacts.require("EthereumForkArbiter");
const Neumark = artifacts.require("Neumark");
const LockedAccount = artifacts.require("LockedAccount");
const EtherToken = artifacts.require("EtherToken");
const EuroToken = artifacts.require("EuroToken");
const Commitment = artifacts.require("Commitment");

const now = Date.now() / 1000;
const Q18 = web3.toBigNumber("10").pow(18);

// Contracts parameters for live network
const LOCK_DURATION = 18 * 30 * 24 * 60 * 60;
const PENALTY_FRACTION = web3.toBigNumber("0.1").mul(Q18);

let START_DATE = Date.UTC(2017, 10, 15) / 1000;
const CAP_EUR = web3.toBigNumber("200000000").mul(Q18);
const MIN_TICKET_EUR = web3.toBigNumber("300").mul(Q18);
const ETH_EUR_FRACTION = web3.toBigNumber("300").mul(Q18);

let PLATFORM_OPERATOR_WALLET;

module.exports = function deployContracts(deployer, network, accounts) {
  // do not deploy testing network
  if (network === "inprocess_test" || network === "coverage") return;
  [, , , PLATFORM_OPERATOR_WALLET] = controlAccounts(network, accounts);
  if (!network.endsWith("_live")) {
    // start ICO in one day
    START_DATE = now * 1 * 24 * 60 * 60;
  }

  deployer.then(async () => {
    console.log("AccessControl deployment...");
    await deployer.deploy(RoleBasedAccessControl);
    const accessControl = await RoleBasedAccessControl.deployed();

    console.log("EthereumForkArbiter deployment...");
    await deployer.deploy(EthereumForkArbiter, accessControl.address);
    const ethereumForkArbiter = await EthereumForkArbiter.deployed();

    console.log("Neumark deploying...");
    await deployer.deploy(
      Neumark,
      accessControl.address,
      ethereumForkArbiter.address
    );
    const neumark = await Neumark.deployed();

    console.log("EtherToken deploying...");
    await deployer.deploy(EtherToken, accessControl.address);
    const etherToken = await EtherToken.deployed();

    console.log("EuroToken deploying...");
    await deployer.deploy(EuroToken, accessControl.address);
    const euroToken = await EuroToken.deployed();

    console.log("LockedAccount(EtherToken) deploying...");
    await deployer.deploy(
      LockedAccount,
      accessControl.address,
      etherToken.address,
      neumark.address,
      LOCK_DURATION,
      PENALTY_FRACTION
    );
    const etherLock = await LockedAccount.deployed();

    console.log("LockedAccount(EuroToken) deploying...");
    await deployer.deploy(
      LockedAccount,
      accessControl.address,
      euroToken.address,
      neumark.address,
      LOCK_DURATION,
      PENALTY_FRACTION
    );
    const euroLock = await LockedAccount.deployed();

    console.log("Commitment deploying...");
    await deployer.deploy(
      Commitment,
      accessControl.address,
      ethereumForkArbiter.address,
      START_DATE,
      PLATFORM_OPERATOR_WALLET,
      neumark.address,
      etherToken.address,
      euroToken.address,
      etherLock.address,
      euroLock.address,
      CAP_EUR,
      MIN_TICKET_EUR,
      ETH_EUR_FRACTION
    );
    const commitment = await Commitment.deployed();

    console.log("Contracts deployed!");

    console.log("----------------------------------");
    console.log(`ICO contract: ${commitment.address}`);
    console.log("----------------------------------");
  });
};

require("babel-register");
const getConfig = require("./config").default;

const RoleBasedAccessPolicy = artifacts.require("RoleBasedAccessPolicy");
const EthereumForkArbiter = artifacts.require("EthereumForkArbiter");
const Neumark = artifacts.require("Neumark");
const LockedAccount = artifacts.require("LockedAccount");
const EtherToken = artifacts.require("EtherToken");
const EuroToken = artifacts.require("EuroToken");
const Commitment = artifacts.require("Commitment");

module.exports = function deployContracts(deployer, network, accounts) {
  // do not deploy testing network
  if (network === "inprocess_test" || network === "coverage") return;
  const CONFIG = getConfig(web3, network, accounts);
  console.log("----------------------------------");
  console.log("Deployment parameters:");
  console.log(CONFIG);
  console.log("----------------------------------");

  deployer.then(async () => {
    console.log("AccessPolicy deployment...");
    await deployer.deploy(RoleBasedAccessPolicy);
    const accessPolicy = await RoleBasedAccessPolicy.deployed();

    console.log("EthereumForkArbiter deployment...");
    await deployer.deploy(EthereumForkArbiter, accessPolicy.address);
    const ethereumForkArbiter = await EthereumForkArbiter.deployed();

    console.log("Neumark deploying...");
    await deployer.deploy(
      Neumark,
      accessPolicy.address,
      ethereumForkArbiter.address
    );
    const neumark = await Neumark.deployed();

    console.log("EtherToken deploying...");
    await deployer.deploy(EtherToken, accessPolicy.address);
    const etherToken = await EtherToken.deployed();

    console.log("EuroToken deploying...");
    await deployer.deploy(EuroToken, accessPolicy.address);
    const euroToken = await EuroToken.deployed();

    console.log("LockedAccount(EtherToken) deploying...");
    await deployer.deploy(
      LockedAccount,
      accessPolicy.address,
      etherToken.address,
      neumark.address,
      CONFIG.LOCK_DURATION,
      CONFIG.PENALTY_FRACTION
    );
    const etherLock = await LockedAccount.deployed();

    console.log("LockedAccount(EuroToken) deploying...");
    await deployer.deploy(
      LockedAccount,
      accessPolicy.address,
      euroToken.address,
      neumark.address,
      CONFIG.LOCK_DURATION,
      CONFIG.PENALTY_FRACTION
    );
    const euroLock = await LockedAccount.deployed();

    console.log("Commitment deploying...");
    await deployer.deploy(
      Commitment,
      accessPolicy.address,
      ethereumForkArbiter.address,
      CONFIG.START_DATE,
      CONFIG.addresses.PLATFORM_OPERATOR_WALLET,
      neumark.address,
      etherToken.address,
      euroToken.address,
      etherLock.address,
      euroLock.address,
      CONFIG.CAP_EUR,
      CONFIG.MIN_TICKET_EUR,
      CONFIG.ETH_EUR_FRACTION
    );
    const commitment = await Commitment.deployed();

    console.log("Contracts deployed!");

    console.log("----------------------------------");
    console.log(`ICO contract: ${commitment.address}`);
    console.log("----------------------------------");
  });
};

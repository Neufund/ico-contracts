require("babel-register");

const RoleBasedAccessControl = artifacts.require("RoleBasedAccessControl");
const EthereumForkArbiter = artifacts.require("EthereumForkArbiter");
const Neumark = artifacts.require("Neumark");
const LockedAccount = artifacts.require("LockedAccount");
const EtherToken = artifacts.require("EtherToken");
const PublicCommitment = artifacts.require("PublicCommitment");

// Needs to match contracts/AccessControl/RoleBasedAccessControl.sol:TriState
const TriState = { Unset: 0, Allow: 1, Deny: 2 };
const EVERYONE = "0x0";

const months = 30 * 24 * 60 * 60;
const ether = Wei => Wei * 10 ** 18;

/* const minCap = new web3.BigNumber(web3.toWei(1, 'ether'));
const maxCap = new web3.BigNumber(web3.toWei(30, 'ether'));
const startDate = Date.now.getTime() / 1000; */

module.exports = function deployContracts(deployer, network, accounts) {
  deployer.then(async () => {
    const lockedAccountAdmin = accounts[1];
    const whitelistAdmin = accounts[2];
    const platformOperatorWallet = accounts[3];

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
      ethereumForkArbiter.address,
      "ipfs:QmPXME1oRtoT627YKaDPDQ3PwA8tdP9rWuAAweLzqSwAWT"
    );
    const neumark = await Neumark.deployed();
    console.log("EtherToken deploying...");
    await deployer.deploy(EtherToken, accessControl.address);
    const etherToken = await EtherToken.deployed();
    console.log("LockedAccount deploying...");
    await deployer.deploy(
      LockedAccount,
      accessControl.address,
      ethereumForkArbiter.address,
      "ipfs:QmPXME1oRtoT627YKaDPDQ3PwA8tdP9rWuAAweLzqSwAWT",
      etherToken.address,
      neumark.address,
      18 * months,
      Math.round(0.1 * ether(1)) // fractions are in 10**18
    );
    const lock = await LockedAccount.deployed();
    console.log("PublicCommitment deploying...");
    await deployer.deploy(
      PublicCommitment,
      accessControl.address,
      etherToken.address,
      lock.address,
      neumark.address
    );
    const publicCommitment = await PublicCommitment.deployed();
    console.log("Setting commitment terms...");
    await publicCommitment.setCommitmentTerms(
      Date.now() / 1000 + 60,
      Date.now() / 1000 + 900,
      ether(1),
      ether(2000),
      ether(1), // min ticket size
      ether(200), // eur rate to eth
      platformOperatorWallet
    );
    console.log("Commitment terms set");
    console.log("Seting permissions");
    await accessControl.setUserRole(
      publicCommitment.address,
      web3.sha3("NeumarkIssuer"),
      neumark.address,
      TriState.Allow
    );
    await accessControl.setUserRole(
      EVERYONE,
      web3.sha3("NeumarkBurner"),
      neumark.address,
      TriState.Allow
    );
    await accessControl.setUserRole(
      EVERYONE,
      web3.sha3("SnapshotCreator"),
      neumark.address,
      TriState.Allow
    );
    await accessControl.setUserRole(
      publicCommitment.address,
      web3.sha3("TransfersAdmin"),
      neumark.address,
      TriState.Allow
    );
    await accessControl.setUserRole(
      lockedAccountAdmin,
      web3.sha3("LockedAccountAdmin"),
      lock.address,
      TriState.Allow
    );
    await lock.setController(publicCommitment.address, {
      from: lockedAccountAdmin
    });
    await accessControl.setUserRole(
      whitelistAdmin,
      web3.sha3("WhitelistAdmin"),
      PublicCommitment.address,
      TriState.Allow
    );
    console.log("Contracts deployed!");

    console.log("----------------------------------");
    console.log(`ICO contract: ${publicCommitment.address}`);
    console.log("----------------------------------");
  });
};

require("babel-register");

const NeumarkController = artifacts.require("NeumarkController");
const Neumark = artifacts.require("Neumark");
const LockedAccount = artifacts.require("LockedAccount");
const SafeMath = artifacts.require("SafeMath");
const EtherToken = artifacts.require("EtherToken");
const PublicCommitment = artifacts.require("PublicCommitment");
const Curve = artifacts.require("Curve");
const RoleBasedAccessControl = artifacts.require("RoleBasedAccessControl");
const AccessRoles = artifacts.require("AccessRoles");

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const months = 30 * 24 * 60 * 60;
const FP_SCALE = 10000;
const ether = Wei => Wei * 10 ** 18;

/* const minCap = new web3.BigNumber(web3.toWei(1, 'ether'));
const maxCap = new web3.BigNumber(web3.toWei(30, 'ether'));
const startDate = Date.now.getTime() / 1000; */

module.exports = function(deployer, network, accounts) {
  deployer.then(async () => {
    console.log("AccessControl deployment...");
    await deployer.deploy(RoleBasedAccessControl);
    const accessControl = await RoleBasedAccessControl.deployed();
    console.log("Neumark deploying...");
    await deployer.deploy(Neumark);
    await deployer.deploy(NeumarkController, Neumark.address);
    const neumark = await Neumark.deployed();
    await neumark.changeController(NeumarkController.address);
    console.log("ETR-T and LockedAccount deploying...");
    await deployer.deploy(EtherToken);
    const etherToken = await EtherToken.deployed();
    await deployer.deploy(Curve, NeumarkController.address);
    await deployer.deploy(
      LockedAccount,
      etherToken.address,
      Curve.address,
      accessControl.address,
      18 * months,
      Math.round(0.1 * ether(1)) // fractions are in 10**18
    );
    const lock = await LockedAccount.deployed();
    console.log("Deploying public commitment");
    await deployer.deploy(
      PublicCommitment,
      Date.now() / 1000 + 60,
      Date.now() / 1000 + 900,
      ether(1),
      ether(2000),
      ether(1), // min ticket size
      ether(200), // eur rate to eth
      etherToken.address,
      lock.address,
      Curve.address
    );
    const publicCommitment = await PublicCommitment.deployed();
    console.log("Commitment deployed");
    console.log("Seting permissions");
    await deployer.deploy(AccessRoles);
    const accessRoles = await AccessRoles.deployed();
    await accessControl.setUserRole(
      accounts[1],
      await accessRoles.ROLE_LOCKED_ACCOUNT_ADMIN(),
      lock.address,
      1
    ); // 1 is True
    await lock.setController(publicCommitment.address, { from: accounts[1] });
    await accessControl.setUserRole(
      accounts[2],
      await accessRoles.ROLE_WHITELIST_ADMIN(),
      PublicCommitment.address,
      1
    );
    console.log("Contracts deployed!");

    console.log("----------------------------------");
    console.log(`ICO contract: ${publicCommitment.address}`);
    console.log("----------------------------------");
  });
};

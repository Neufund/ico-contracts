require("babel-register");

const Neumark = artifacts.require("Neumark");
const LockedAccount = artifacts.require("LockedAccount");
const EtherToken = artifacts.require("EtherToken");
const PublicCommitment = artifacts.require("PublicCommitment");
const RoleBasedAccessControl = artifacts.require("RoleBasedAccessControl");
const AccessRoles = artifacts.require("AccessRoles");

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
    console.log("AccessControl deployment...");
    await deployer.deploy(RoleBasedAccessControl);
    const accessControl = await RoleBasedAccessControl.deployed();
    console.log("Neumark deploying...");
    await deployer.deploy(Neumark, accessControl.address);
    const neumark = await Neumark.deployed();
    console.log("ETR-T and LockedAccount deploying...");
    await deployer.deploy(EtherToken);
    const etherToken = await EtherToken.deployed();
    await deployer.deploy(
      LockedAccount,
      accessControl.address,
      etherToken.address,
      neumark.address,
      18 * months,
      Math.round(0.1 * ether(1)) // fractions are in 10**18
    );
    const lock = await LockedAccount.deployed();
    console.log("Deploying public commitment");
    await deployer.deploy(
      PublicCommitment,
      etherToken.address,
      lock.address,
      neumark.address
    );
    const publicCommitment = await PublicCommitment.deployed();
    console.log("Commitment deployed");
    await publicCommitment.setCommitmentTerms(
      Date.now() / 1000 + 60,
      Date.now() / 1000 + 900,
      ether(1),
      ether(2000),
      ether(1), // min ticket size
      ether(200) // eur rate to eth
    );
    console.log("Commitment terms set");
    console.log("Seting permissions");
    await deployer.deploy(AccessRoles);
    const accessRoles = await AccessRoles.deployed();
    await accessControl.setUserRole(
      publicCommitment.address,
      await accessRoles.ROLE_NEUMARK_ISSUER(),
      neumark.address,
      TriState.Allow
    );
    await accessControl.setUserRole(
      EVERYONE,
      await accessRoles.ROLE_NEUMARK_BURNER(),
      neumark.address,
      TriState.Allow
    );
    await accessControl.setUserRole(
      EVERYONE,
      await accessRoles.ROLE_SNAPSHOT_CREATOR(),
      neumark.address,
      TriState.Allow
    );
    await accessControl.setUserRole(
      publicCommitment.address,
      await accessRoles.ROLE_TRANSFERS_ADMIN(),
      neumark.address,
      TriState.Allow
    );
    await accessControl.setUserRole(
      accounts[1],
      await accessRoles.ROLE_LOCKED_ACCOUNT_ADMIN(),
      lock.address,
      TriState.Allow
    );
    await lock.setController(publicCommitment.address, { from: accounts[1] });
    await accessControl.setUserRole(
      accounts[2],
      await accessRoles.ROLE_WHITELIST_ADMIN(),
      PublicCommitment.address,
      TriState.Allow
    );
    console.log("Contracts deployed!");

    console.log("----------------------------------");
    console.log(`ICO contract: ${publicCommitment.address}`);
    console.log("----------------------------------");
  });
};

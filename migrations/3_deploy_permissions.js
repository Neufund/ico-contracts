require("babel-register");
const controlAccounts = require("./accounts").default;

const RoleBasedAccessControl = artifacts.require("RoleBasedAccessControl");
const Neumark = artifacts.require("Neumark");
const LockedAccount = artifacts.require("LockedAccount");
const EuroToken = artifacts.require("EuroToken");
const Commitment = artifacts.require("Commitment");

// Needs to match contracts/AccessControl/RoleBasedAccessControl.sol:TriState
const TriState = { Unset: 0, Allow: 1, Deny: 2 };
const EVERYONE = "0x0";
const GLOBAL = "0x0";

// Maps roles to accounts on live network
let LOCKED_ACCOUNT_ADMIN;
let WHITELIST_ADMIN;
let PLATFORM_OPERATOR_REPRESENTATIVE;
let EURT_DEPOSIT_MANAGER;

module.exports = function deployContracts(deployer, network, accounts) {
  // do not deploy testing network
  if (network === "inprocess_test" || network === "coverage") return;
  [
    ,
    LOCKED_ACCOUNT_ADMIN,
    WHITELIST_ADMIN,
    ,
    PLATFORM_OPERATOR_REPRESENTATIVE,
    EURT_DEPOSIT_MANAGER
  ] = controlAccounts(network, accounts);
  const DEPLOYER = accounts[0];

  deployer.then(async () => {
    const accessControl = await RoleBasedAccessControl.deployed();
    const neumark = await Neumark.deployed();
    const euroToken = await EuroToken.deployed();
    const euroLock = await LockedAccount.deployed();
    const commitment = await Commitment.deployed();

    console.log("Seting permissions");
    await accessControl.setUserRole(
      commitment.address,
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
      LOCKED_ACCOUNT_ADMIN,
      web3.sha3("LockedAccountAdmin"),
      GLOBAL,
      TriState.Allow
    );
    await accessControl.setUserRole(
      WHITELIST_ADMIN,
      web3.sha3("WhitelistAdmin"),
      commitment.address,
      TriState.Allow
    );
    await accessControl.setUserRole(
      PLATFORM_OPERATOR_REPRESENTATIVE,
      web3.sha3("PlatformOperatorRepresentative"),
      GLOBAL,
      TriState.Allow
    );
    await accessControl.setUserRole(
      EURT_DEPOSIT_MANAGER,
      web3.sha3("EurtDepositManager"),
      euroToken.address,
      TriState.Allow
    );

    // deposit role to yourself during deployment and relinquish control later
    await accessControl.setUserRole(
      DEPLOYER,
      web3.sha3("EurtDepositManager"),
      euroToken.address,
      TriState.Allow
    );

    console.log("EuroToken deposit permissions");
    await euroToken.setAllowedTransferFrom(commitment.address, true, {
      from: DEPLOYER
    });
    await euroToken.setAllowedTransferTo(commitment.address, true, {
      from: DEPLOYER
    });
    await euroToken.setAllowedTransferTo(euroLock.address, true, {
      from: DEPLOYER
    });
    await euroToken.setAllowedTransferFrom(euroLock.address, true, {
      from: DEPLOYER
    });
  });
};

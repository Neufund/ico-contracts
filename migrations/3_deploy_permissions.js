require("babel-register");
const getConfig = require("./config").default;
const { TriState, EVERYONE, GLOBAL } = require("../test/helpers/triState");

const RoleBasedAccessPolicy = artifacts.require("RoleBasedAccessPolicy");
const Neumark = artifacts.require("Neumark");
const LockedAccount = artifacts.require("LockedAccount");
const EuroToken = artifacts.require("EuroToken");
const Commitment = artifacts.require("Commitment");

module.exports = function deployContracts(deployer, network, accounts) {
  // do not deploy testing network
  if (network.endsWith("_test") || network === "coverage") return;

  const CONFIG = getConfig(web3, network, accounts);
  const DEPLOYER = accounts[0];

  deployer.then(async () => {
    const accessPolicy = await RoleBasedAccessPolicy.deployed();
    const neumark = await Neumark.deployed();
    const euroToken = await EuroToken.deployed();
    const euroLock = await LockedAccount.deployed();
    const commitment = await Commitment.deployed();

    console.log("Seting permissions");
    await accessPolicy.setUserRole(
      commitment.address,
      web3.sha3("NeumarkIssuer"),
      neumark.address,
      TriState.Allow
    );
    await accessPolicy.setUserRole(
      EVERYONE,
      web3.sha3("NeumarkBurner"),
      neumark.address,
      TriState.Allow
    );
    await accessPolicy.setUserRole(
      CONFIG.addresses.LOCKED_ACCOUNT_ADMIN,
      web3.sha3("LockedAccountAdmin"),
      GLOBAL,
      TriState.Allow
    );
    await accessPolicy.setUserRole(
      CONFIG.addresses.WHITELIST_ADMIN,
      web3.sha3("WhitelistAdmin"),
      commitment.address,
      TriState.Allow
    );
    await accessPolicy.setUserRole(
      CONFIG.addresses.PLATFORM_OPERATOR_REPRESENTATIVE,
      web3.sha3("PlatformOperatorRepresentative"),
      GLOBAL,
      TriState.Allow
    );
    await accessPolicy.setUserRole(
      CONFIG.addresses.EURT_DEPOSIT_MANAGER,
      web3.sha3("EurtDepositManager"),
      euroToken.address,
      TriState.Allow
    );

    // deposit role to yourself during deployment and relinquish control later
    await accessPolicy.setUserRole(
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

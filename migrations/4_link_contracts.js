require("babel-register");
const controlAccounts = require("./accounts").default;

const RoleBasedAccessControl = artifacts.require("RoleBasedAccessControl");
const LockedAccount = artifacts.require("LockedAccount");
const Commitment = artifacts.require("Commitment");

// Needs to match contracts/AccessControl/RoleBasedAccessControl.sol:TriState
const TriState = { Unset: 0, Allow: 1, Deny: 2 };
const GLOBAL = "0x0";

// Maps roles to accounts on live network
let PLATFORM_OPERATOR_WALLET;

module.exports = function deployContracts(deployer, network, accounts) {
  // do not deploy testing network
  if (network === "inprocess_test" || network === "coverage") return;
  [, , , PLATFORM_OPERATOR_WALLET] = controlAccounts(network, accounts);
  const DEPLOYER = accounts[0];

  deployer.then(async () => {
    const accessControl = await RoleBasedAccessControl.deployed();
    const commitment = await Commitment.deployed();
    const etherLock = await LockedAccount.at(await commitment.etherLock());
    const euroLock = await LockedAccount.at(await commitment.euroLock());

    // locked account admin role to yourself during deployment and relinquish control later
    await accessControl.setUserRole(
      DEPLOYER,
      web3.sha3("LockedAccountAdmin"),
      GLOBAL,
      TriState.Allow
    );

    console.log("Attaching Commitment to LockedAccounts");
    await euroLock.setController(commitment.address, {
      from: DEPLOYER
    });
    await etherLock.setController(commitment.address, {
      from: DEPLOYER
    });
    console.log("Setting fee disbursal address");
    await euroLock.setPenaltyDisbursal(PLATFORM_OPERATOR_WALLET, {
      from: DEPLOYER
    });
    await etherLock.setPenaltyDisbursal(PLATFORM_OPERATOR_WALLET, {
      from: DEPLOYER
    });
  });
};

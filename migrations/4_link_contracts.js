require("babel-register");
const getConfig = require("./config").default;
const { TriState, GLOBAL } = require("../test/helpers/triState");

const RoleBasedAccessPolicy = artifacts.require("RoleBasedAccessPolicy");
const LockedAccount = artifacts.require("LockedAccount");
const Commitment = artifacts.require("Commitment");

module.exports = function deployContracts(deployer, network, accounts) {
  // do not deploy testing network
  if (network === "inprocess_test" || network === "coverage") return;

  const CONFIG = getConfig(web3, network, accounts);
  const DEPLOYER = accounts[0];

  deployer.then(async () => {
    const accessPolicy = await RoleBasedAccessPolicy.deployed();
    const commitment = await Commitment.deployed();
    const etherLock = await LockedAccount.at(await commitment.etherLock());
    const euroLock = await LockedAccount.at(await commitment.euroLock());

    // locked account admin role to yourself during deployment and relinquish control later
    await accessPolicy.setUserRole(
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
    await euroLock.setPenaltyDisbursal(
      CONFIG.addresses.PLATFORM_OPERATOR_WALLET,
      {
        from: DEPLOYER
      }
    );
    await etherLock.setPenaltyDisbursal(
      CONFIG.addresses.PLATFORM_OPERATOR_WALLET,
      {
        from: DEPLOYER
      }
    );
  });
};

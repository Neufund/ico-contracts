require("babel-register");
const getConfig = require("./config").default;
const { TriState, GLOBAL } = require("../test/helpers/triState");

const RoleBasedAccessPolicy = artifacts.require("RoleBasedAccessPolicy");
const EuroToken = artifacts.require("EuroToken");

module.exports = function deployContracts(deployer, network, accounts) {
  // do not deploy testing network
  if (network.endsWith("_test") || network === "coverage") return;

  const CONFIG = getConfig(web3, network, accounts);

  deployer.then(async () => {
    if (network.endsWith("_live")) {
      const accessPolicy = await RoleBasedAccessPolicy.deployed();
      const euroToken = await EuroToken.deployed();
      const DEPLOYER = accounts[0];

      console.log("Dropping temporary permissions");
      await accessPolicy.setUserRole(
        DEPLOYER,
        web3.sha3("EurtDepositManager"),
        euroToken.address,
        TriState.Unset
      );
      await accessPolicy.setUserRole(
        DEPLOYER,
        web3.sha3("LockedAccountAdmin"),
        GLOBAL,
        TriState.Unset
      );

      console.log(
        `Adding new ACCESS_CONTROLLER to ${CONFIG.addresses.ACCESS_CONTROLLER}`
      );
      await accessPolicy.setUserRole(
        CONFIG.addresses.ACCESS_CONTROLLER,
        web3.sha3("AccessController"),
        GLOBAL,
        TriState.Allow
      );
      await accessPolicy.setUserRole(
        CONFIG.addresses.ACCESS_CONTROLLER,
        web3.sha3("AccessController"),
        accessPolicy.address,
        TriState.Allow
      );
      await accessPolicy.setUserRole(
        DEPLOYER,
        web3.sha3("AccessController"),
        GLOBAL,
        TriState.Unset
      );
      console.log("---------------------------------------------");
      console.log(
        `New ACCESS_CONTROLLER ${
          CONFIG.addresses.ACCESS_CONTROLLER
        } must remove access to deployer ${DEPLOYER} for object ${
          accessPolicy.address
        }`
      );
      console.log("---------------------------------------------");

      /* await accessPolicy.setUserRole(
        DEPLOYER,
        web3.sha3("AccessController"),
        accessPolicy.address,
        TriState.Unset,
        {from: CONFIG.addresses.ACCESS_CONTROLLER}
      ); */
    } else {
      console.log("---------------------------------------------");
      console.log("Will relinquish control only on live network");
      console.log("---------------------------------------------");
    }
  });
};

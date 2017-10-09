require("babel-register");
const getConfig = require("./config").default;
const { TriState, GLOBAL } = require("../test/helpers/triState");

const RoleBasedAccessControl = artifacts.require("RoleBasedAccessControl");
const EuroToken = artifacts.require("EuroToken");

module.exports = function deployContracts(deployer, network, accounts) {
  // do not deploy testing network
  if (network === "inprocess_test" || network === "coverage") return;

  const CONFIG = getConfig(web3, network, accounts);

  deployer.then(async () => {
    if (network.endsWith("_live")) {
      const accessControl = await RoleBasedAccessControl.deployed();
      const euroToken = await EuroToken.deployed();
      const DEPLOYER = accounts[0];

      console.log("Dropping temporary permissions");
      await accessControl.setUserRole(
        DEPLOYER,
        web3.sha3("EurtDepositManager"),
        euroToken.address,
        TriState.Unset
      );
      await accessControl.setUserRole(
        DEPLOYER,
        web3.sha3("LockedAccountAdmin"),
        GLOBAL,
        TriState.Unset
      );

      console.log(
        `Adding new ACCESS_CONTROLLER to ${CONFIG.addresses.ACCESS_CONTROLLER}`
      );
      await accessControl.setUserRole(
        CONFIG.addresses.ACCESS_CONTROLLER,
        web3.sha3("AccessController"),
        GLOBAL,
        TriState.Allow
      );
      await accessControl.setUserRole(
        CONFIG.addresses.ACCESS_CONTROLLER,
        web3.sha3("AccessController"),
        accessControl.address,
        TriState.Allow
      );
      await accessControl.setUserRole(
        DEPLOYER,
        web3.sha3("AccessController"),
        GLOBAL,
        TriState.Unset
      );
      console.log("---------------------------------------------");
      console.log(
        `New ACCESS_CONTROLLER ${CONFIG.addresses
          .ACCESS_CONTROLLER} must remove access to deployer ${DEPLOYER} for object ${accessControl.address}`
      );
      console.log("---------------------------------------------");

      /* await accessControl.setUserRole(
        DEPLOYER,
        web3.sha3("AccessController"),
        accessControl.address,
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

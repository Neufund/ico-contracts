require("babel-register");
const controlAccounts = require("./accounts").default;

const RoleBasedAccessControl = artifacts.require("RoleBasedAccessControl");
const EuroToken = artifacts.require("EuroToken");

// Needs to match contracts/AccessControl/RoleBasedAccessControl.sol:TriState
const TriState = { Unset: 0, Allow: 1, Deny: 2 };
const GLOBAL = "0x0";

// Maps roles to accounts on live network
let ACCESS_CONTROLLER;

module.exports = function deployContracts(deployer, network, accounts) {
  // do not deploy testing network
  if (network === "inprocess_test" || network === "coverage") return;
  [ACCESS_CONTROLLER] = controlAccounts(network, accounts);

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

      console.log(`Adding new ACCESS_CONTROLLER to ${ACCESS_CONTROLLER}`);
      await accessControl.setUserRole(
        ACCESS_CONTROLLER,
        web3.sha3("AccessController"),
        GLOBAL,
        TriState.Allow
      );
      await accessControl.setUserRole(
        ACCESS_CONTROLLER,
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
        `New ACCESS_CONTROLLER ${ACCESS_CONTROLLER} must remove access to deployer ${DEPLOYER} for object ${accessControl.address}`
      );
      console.log("---------------------------------------------");

      /* await accessControl.setUserRole(
        DEPLOYER,
        web3.sha3("AccessController"),
        accessControl.address,
        TriState.Unset,
        {from: ACCESS_CONTROLLER}
      ); */
    } else {
      console.log("---------------------------------------------");
      console.log("Will relinquish control only on live network");
      console.log("---------------------------------------------");
    }
  });
};

const Migrations = artifacts.require("./Migrations.sol");

module.exports = function deployMigration(deployer, network) {
  // do not deploy testing network
  if (network.endsWith("_test") || network === "coverage") return;
  deployer.deploy(Migrations);
};

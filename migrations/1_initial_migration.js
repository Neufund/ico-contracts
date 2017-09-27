const Migrations = artifacts.require("./Migrations.sol");

module.exports = function deployMigration(deployer, network) {
  // do not deploy testing network
  if (network === "inprocess_test") return;
  deployer.deploy(Migrations);
};

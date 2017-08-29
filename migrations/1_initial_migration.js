const Migrations = artifacts.require("./Migrations.sol");

module.exports = function deployMigration(deployer) {
  deployer.deploy(Migrations);
};

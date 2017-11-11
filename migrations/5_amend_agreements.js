require("babel-register");
const getConfig = require("./config").default;

const Neumark = artifacts.require("Neumark");
const Commitment = artifacts.require("Commitment");

module.exports = function deployContracts(deployer, network, accounts) {
  // do not deploy testing network
  if (network.endsWith("_test") || network === "coverage") return;

  const CONFIG = getConfig(web3, network, accounts);

  if (network.endsWith("_live")) {
    console.log("---------------------------------------------");
    console.log(
      `Must use ${
        CONFIG.addresses.PLATFORM_OPERATOR_REPRESENTATIVE
      } account to deploy agreements on live network`
    );
    console.log("---------------------------------------------");
    return;
  }

  deployer.then(async () => {
    const neumark = await Neumark.deployed();
    const commitment = await Commitment.deployed();

    console.log("Amending agreements");
    await neumark.amendAgreement(CONFIG.NEUMARK_HOLDER_AGREEMENT, {
      from: CONFIG.addresses.PLATFORM_OPERATOR_REPRESENTATIVE
    });
    await commitment.amendAgreement(CONFIG.RESERVATION_AGREEMENT, {
      from: CONFIG.addresses.PLATFORM_OPERATOR_REPRESENTATIVE
    });
  });
};

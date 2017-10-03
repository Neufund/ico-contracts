require("babel-register");
const controlAccounts = require("./accounts").default;

const Neumark = artifacts.require("Neumark");
const Commitment = artifacts.require("Commitment");

// Maps roles to accounts on live network
let PLATFORM_OPERATOR_REPRESENTATIVE;
const RESERVATION_AGREEMENT =
  "ipfs:QmPXME1oRtoT627YKaDPDQ3PwA8tdP9rWuAAweLzqSwAWT";
const NEUMARK_HOLDER_AGREEMENT =
  "ipfs:QmPXME1oRtoT627YKaDPDQ3PwA8tdP9rWuAAweLzqSwAWT";

module.exports = function deployContracts(deployer, network, accounts) {
  // do not deploy testing network
  if (network === "inprocess_test" || network === "coverage") return;
  [, , , , PLATFORM_OPERATOR_REPRESENTATIVE] = controlAccounts(
    network,
    accounts
  );
  if (network.endsWith("_live")) {
    console.log("---------------------------------------------");
    console.log(
      `Must use ${PLATFORM_OPERATOR_REPRESENTATIVE} account to deploy agreements on live newtork`
    );
    console.log("---------------------------------------------");
    return;
  }

  deployer.then(async () => {
    const neumark = await Neumark.deployed();
    const commitment = await Commitment.deployed();

    console.log("Amending agreements");
    await neumark.amendAgreement(NEUMARK_HOLDER_AGREEMENT, {
      from: PLATFORM_OPERATOR_REPRESENTATIVE
    });
    await commitment.amendAgreement(RESERVATION_AGREEMENT, {
      from: PLATFORM_OPERATOR_REPRESENTATIVE
    });
  });
};

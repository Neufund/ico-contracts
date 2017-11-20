/* eslint-disable no-console */

// eslint-disable-next-line import/no-extraneous-dependencies
require("babel-register");
const Promise = require("bluebird");
const getConfig = require("../migrations/config").default;

const {
  prepareReservationAgreement,
  prepareNeumarkTokenHolderAgreement
} = require("./prepareDocuments");

const Neumark = artifacts.require("Neumark");
const LockedAccount = artifacts.require("LockedAccount");
const Commitment = artifacts.require("Commitment");

module.exports = async function prefillAgreements() {
  try {
    const neumark = await Neumark.deployed();
    const commitment = await Commitment.deployed();
    const etherLock = await LockedAccount.at(await commitment.etherLock());
    const getWeb3Accounts = Promise.promisify(web3.eth.getAccounts);

    const configrations = getConfig(
      web3,
      artifacts.options._values.network,
      await getWeb3Accounts()
    );
    console.log("Starting: Reservation Agreement");
    await prepareReservationAgreement({
      neumarkContract: neumark,
      commitmentContract: commitment,
      companyAddress: configrations.addresses.PLATFORM_OPERATOR_REPRESENTATIVE
    });
    console.log("Starting: Token Holder Agreement");
    await prepareNeumarkTokenHolderAgreement({
      neumarkContract: neumark,
      companyAddress: configrations.addresses.PLATFORM_OPERATOR_REPRESENTATIVE
    });
    console.log("Done");
  } catch (err) {
    console.log(err);
  }
};

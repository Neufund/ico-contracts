/* eslint-disable no-console */

// eslint-disable-next-line import/no-extraneous-dependencies
require("babel-register");
const {
  prepareReservationAgreement,
  prepareNeumarkTokenHolderAgreement
} = require("../legal/prepareDocuments");

const Neumark = artifacts.require("Neumark");
const LockedAccount = artifacts.require("LockedAccount");
const Commitment = artifacts.require("Commitment");

module.exports = async function(callback) {
  const neumark = await Neumark.deployed();
  const commitment = await Commitment.deployed();
  const etherLock = await LockedAccount.at(await commitment.etherLock());

  await prepareReservationAgreement({
    neumarkContract: neumark,
    commitmentContract: commitment,
    lockedAccountContract: etherLock,
    companyAddress: "0x83CBaB70Bc1d4e08997e5e00F2A3f1bCE225811F"
  });

  await prepareNeumarkTokenHolderAgreement({
    neumarkContract: neumark,
    companyAddress: "0x83CBaB70Bc1d4e08997e5e00F2A3f1bCE225811F"
  });
};

require("babel-register");
const fs = require("fs");
const { join } = require("path");
const replaceString = require("replace-string");
const gitRev = require("git-rev-sync");
const { formatMoney, formatDate } = require("./formatters");

const DOCUMENT_CONSTANTS = {
  repoUrl: "git@github.com:Neufund/ico-contracts.git",
  website: "https://commit.neufund.org"
};

async function prepareNeumarkTokenHolderAgreement({
  neumarkContract,
  companyAddress
}) {
  const neuDecimals = (await neumarkContract.decimals()).toNumber();

  const tags = {
    "repo-url": DOCUMENT_CONSTANTS.repoUrl,
    "commit-id": gitRev.long(),
    "neumark-sc-address": neumarkContract.address,
    "company-address": companyAddress,
    "neumark-cap": formatMoney(neuDecimals, await neumarkContract.neumarkCap()),
    "initial-reward": formatMoney(
      neuDecimals,
      await neumarkContract.initialRewardFraction()
    ),
    "fork-arbiter-sc-address": await neumarkContract.ethereumForkArbiter()
  };

  replaceTags(
    join(__dirname, "./NEUMARK TOKEN HOLDER AGREEMENT.html"),
    tags,
    join(__dirname, "./NEUMARK TOKEN HOLDER AGREEMENT.out.html")
  );
}

async function prepareReservationAgreement({
  commitmentContract,
  neumarkContract,
  lockedAccountContract,
  companyAddress
}) {
  const tags = {
    "repo-url": DOCUMENT_CONSTANTS.repoUrl,
    "commit-id": gitRev.long(),
    website: DOCUMENT_CONSTANTS.website,
    "acquisition-sc-address": commitmentContract.address,
    "lockin-sc-address": lockedAccountContract.address,
    "company-address": companyAddress,
    "neumark-sc-address": neumarkContract.address,
    "icbm-start-date": formatDate(
      await commitmentContract.startOf(2) // State.Public
    ),
    "icbm-end-date": formatDate(
      await commitmentContract.startOf(3) // State.Finished
    ),
    "company-neumark-address": await commitmentContract.platformWalletAddress(),
    "fork-arbiter-sc-address": await commitmentContract.ethereumForkArbiter()
  };

  replaceTags(
    join(__dirname, "./RESERVATION AGREEMENT.html"),
    tags,
    join(__dirname, "./RESERVATION AGREEMENT.out.html")
  );
}

function replaceTags(inputPath, tags, outputPath) {
  const inputDocument = fs.readFileSync(inputPath, "utf8");

  let outputDocument = inputDocument;
  Object.keys(tags).forEach(key => {
    const replaced = replaceString(outputDocument, `{${key}}`, tags[key]);

    if (replaced === outputDocument) {
      throw new Error(`Tag ${key} not matched!`);
    }

    outputDocument = replaced;
  });

  fs.writeFileSync(outputPath, outputDocument);
}

module.exports = {
  prepareNeumarkTokenHolderAgreement,
  prepareReservationAgreement
};

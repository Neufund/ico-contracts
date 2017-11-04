const moment = require("moment");

export default function getConfig(web3, network, accounts) {
  const Q18 = web3.toBigNumber("10").pow(18);

  // specifies smart contracts parameters and addresses to be deployed on live network
  // DO NOT EDIT THESE VALUES
  // EDIT BELOW
  const config = {
    // LockedAccount
    LOCK_DURATION: 18 * 30 * 24 * 60 * 60,
    PENALTY_FRACTION: web3.toBigNumber("0.1").mul(Q18),
    // Commitment
    START_DATE: moment("2017-10-30T09:00:00.000Z").valueOf() / 1000,
    CAP_EUR: web3.toBigNumber("200000000").mul(Q18),
    MIN_TICKET_EUR: web3.toBigNumber("298.3").mul(Q18),
    ETH_EUR_FRACTION: web3.toBigNumber("298.3").mul(Q18),
    // Agreements
    RESERVATION_AGREEMENT:
      "ipfs:QmerumBSpNXtHxgQq1NmpY5iJYavDnZc13os6oHY4EuDCX", // attached to Commitment
    NEUMARK_HOLDER_AGREEMENT:
      "ipfs:QmUDZkGzCEAufyxFwNbm66XUFMrXUA5GvuU4a5BwQbTPNw", // attached to Neumark
    addresses: {
      // Maps roles to addresses
      ACCESS_CONTROLLER: "0x8AD8B24594ef90c15B2bd05edE0c67509c036B29",
      LOCKED_ACCOUNT_ADMIN: "0x94c32ab2c5d946aCA3aEbb543b46948d5ad0B622",
      WHITELIST_ADMIN: "0x7F5552B918a6FfC97c1705852029Fb40380aA399",
      PLATFORM_OPERATOR_WALLET: "0xA826813D0eb5D629E959c02b8f7a3d0f53066Ce4",
      PLATFORM_OPERATOR_REPRESENTATIVE:
        "0x83CBaB70Bc1d4e08997e5e00F2A3f1bCE225811F",
      EURT_DEPOSIT_MANAGER: "0x30A72cD2F5AEDCd86c7f199E0500235674a08E27"
    }
  };

  // modify live configuration according to network type
  if (!network.endsWith("_live")) {
    // start ICO in one day
    const now = Math.floor(Date.now() / 1000);
    config.START_DATE = now + 60;
  }

  // assign addresses to roles according to network type
  const roleMapping = config.addresses;
  if (network === "simulated_live") {
    // on simulated live network, map roles to different accounts, skip deployer (accounts[0])
    roleMapping.ACCESS_CONTROLLER = accounts[1];
    roleMapping.LOCKED_ACCOUNT_ADMIN = accounts[2];
    roleMapping.WHITELIST_ADMIN = accounts[3];
    roleMapping.PLATFORM_OPERATOR_WALLET = accounts[4];
    roleMapping.PLATFORM_OPERATOR_REPRESENTATIVE = accounts[5];
    roleMapping.EURT_DEPOSIT_MANAGER = accounts[6];
  }
  if (!network.endsWith("_live")) {
    // on all test network, map all roles to deployer
    roleMapping.ACCESS_CONTROLLER = accounts[0];
    roleMapping.LOCKED_ACCOUNT_ADMIN = accounts[0];
    roleMapping.WHITELIST_ADMIN = accounts[0];
    roleMapping.PLATFORM_OPERATOR_WALLET = accounts[0];
    roleMapping.PLATFORM_OPERATOR_REPRESENTATIVE = accounts[0];
    roleMapping.EURT_DEPOSIT_MANAGER = accounts[0];
  }

  return config;
}

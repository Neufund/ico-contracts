export default function getConfig(web3, network, accounts) {
  const Q18 = web3.toBigNumber("10").pow(18);

  // specifies smart contracts parameters and addresses to be deployed on live network
  const config = {
    // LockedAccount
    LOCK_DURATION: 18 * 30 * 24 * 60 * 60,
    PENALTY_FRACTION: web3.toBigNumber("0.1").mul(Q18),
    // Commitment
    START_DATE: Date.UTC(2017, 10, 15) / 1000,
    CAP_EUR: web3.toBigNumber("200000000").mul(Q18),
    MIN_TICKET_EUR: web3.toBigNumber("300").mul(Q18),
    ETH_EUR_FRACTION: web3.toBigNumber("300").mul(Q18),
    // Agreements
    RESERVATION_AGREEMENT:
      "ipfs:QmerumBSpNXtHxgQq1NmpY5iJYavDnZc13os6oHY4EuDCX", // attached to Commitment
    NEUMARK_HOLDER_AGREEMENT:
      "ipfs:QmUDZkGzCEAufyxFwNbm66XUFMrXUA5GvuU4a5BwQbTPNw", // attached to Neumark
    addresses: {
      // Maps roles to addresses
      ACCESS_CONTROLLER: "0xaa11C97Be40Cdf6e24229EAA731EE3701C3B9493",
      LOCKED_ACCOUNT_ADMIN: "0xE8Bba2F6bcF6893E66F316d7f2546ee8534F2868",
      WHITELIST_ADMIN: "0x45FE1297E62c57179BEbe2cdcBcf22b9005769b4",
      PLATFORM_OPERATOR_WALLET: "0xfE9641B0f229a2D55a3D1aBC77eCa90648BD5357",
      PLATFORM_OPERATOR_REPRESENTATIVE:
        "0x11CA6fdC4117feb52d8b81adA7AdEBd519dD8D08",
      EURT_DEPOSIT_MANAGER: "0x113b51BFAcbF6BC25B553E2a0B1C90741c25C6eB"
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

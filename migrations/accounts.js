// Maps roles to accounts on live network
const ACCESS_CONTROLLER = "0xaa11C97Be40Cdf6e24229EAA731EE3701C3B9493";
const LOCKED_ACCOUNT_ADMIN = "0xE8Bba2F6bcF6893E66F316d7f2546ee8534F2868";
const WHITELIST_ADMIN = "0x45FE1297E62c57179BEbe2cdcBcf22b9005769b4";
const PLATFORM_OPERATOR_WALLET = "0xfE9641B0f229a2D55a3D1aBC77eCa90648BD5357";
const PLATFORM_OPERATOR_REPRESENTATIVE =
  "0x11CA6fdC4117feb52d8b81adA7AdEBd519dD8D08";
const EURT_DEPOSIT_MANAGER = "0x113b51BFAcbF6BC25B553E2a0B1C90741c25C6eB";

export default function controlAccounts(network, accounts) {
  if (network === "simulated_live") {
    return [
      accounts[1],
      accounts[2],
      accounts[3],
      accounts[4],
      accounts[5],
      accounts[6]
    ];
  }
  if (network.endsWith("_live")) {
    return [
      ACCESS_CONTROLLER,
      LOCKED_ACCOUNT_ADMIN,
      WHITELIST_ADMIN,
      PLATFORM_OPERATOR_WALLET,
      PLATFORM_OPERATOR_REPRESENTATIVE,
      EURT_DEPOSIT_MANAGER
    ];
  }
  return [
    accounts[0],
    accounts[0],
    accounts[0],
    accounts[0],
    accounts[0],
    accounts[0]
  ];
}

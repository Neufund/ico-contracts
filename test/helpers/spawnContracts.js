import { TriState } from "./triState";

const LockedAccount = artifacts.require("LockedAccount");
const EtherToken = artifacts.require("EtherToken");
const NeumarkController = artifacts.require("NeumarkController");
const Neumark = artifacts.require("Neumark");
const Curve = artifacts.require("Curve");
const TestCommitment = artifacts.require("TestCommitment");
const WhitelistedCommitment = artifacts.require("WhitelistedCommitment");
const RoleBasedAccessControl = artifacts.require("RoleBasedAccessControl");
const AccessRoles = artifacts.require("AccessRoles");

const BigNumber = web3.BigNumber;

/* eslint-disable */
export let neumark;
export let neumarkController;
export let etherToken;
export let lockedAccount;
export let curve;
export let commitment;
export let feePool;
export let accessControl;
export let accessRoles;
/* eslint-enable */
export const operatorWallet = "0x55d7d863a155f75c5139e20dcbda8d0075ba2a1c";

export const days = 24 * 60 * 60;
export const months = 30 * 24 * 60 * 60;
export const ether = wei => new BigNumber(wei).mul(10 ** 18);

export async function spawnLockedAccount(
  lockAdminAccount,
  unlockDateMonths,
  unlockPenalty
) {
  accessControl = await RoleBasedAccessControl.new();
  accessRoles = await AccessRoles.new();
  etherToken = await EtherToken.new();
  neumark = await Neumark.new();
  neumarkController = await NeumarkController.new(neumark.address);
  await neumark.changeController(neumarkController.address);
  curve = await Curve.new(neumarkController.address);
  lockedAccount = await LockedAccount.new(
    accessControl.address,
    etherToken.address,
    curve.address,
    unlockDateMonths * months,
    ether(1).mul(unlockPenalty).round()
  );
  const lockedAccountAdminRole = await accessRoles.ROLE_LOCKED_ACCOUNT_ADMIN();
  await accessControl.setUserRole(
    lockAdminAccount,
    lockedAccountAdminRole,
    lockedAccount.address,
    TriState.Allow
  );
  await lockedAccount.setPenaltyDisbursal(operatorWallet, {
    from: lockAdminAccount
  });
}

export async function spawnPublicCommitment(
  lockAdminAccount,
  startTimestamp,
  duration,
  minCommitment,
  maxCommitment,
  minTicket,
  eurEthRate
) {
  commitment = await TestCommitment.new(
    etherToken.address,
    lockedAccount.address,
    curve.address
  );
  await commitment.setCommitmentTerms(
    startTimestamp,
    startTimestamp + duration,
    minCommitment,
    maxCommitment,
    minTicket,
    ether(eurEthRate)
  );
  // console.log(lockedAccount.setController);
  await lockedAccount.setController(commitment.address, {
    from: lockAdminAccount
  });
}

export async function spawnWhitelistedCommitment(
  lockAdminAccount,
  whitelistAdminAccount,
  startTimestamp,
  duration,
  minCommitment,
  maxCommitment,
  minTicket,
  eurEthRate
) {
  commitment = await WhitelistedCommitment.new(
    accessControl.address,
    etherToken.address,
    lockedAccount.address,
    curve.address
  );
  await commitment.setCommitmentTerms(
    startTimestamp,
    startTimestamp + duration,
    minCommitment,
    maxCommitment,
    minTicket,
    ether(eurEthRate)
  );
  // console.log(lockedAccount.setController);
  const whitelistAdminRole = await accessRoles.ROLE_WHITELIST_ADMIN();
  await accessControl.setUserRole(
    whitelistAdminAccount,
    whitelistAdminRole,
    commitment.address,
    TriState.Allow
  );
  await lockedAccount.setController(commitment.address, {
    from: lockAdminAccount
  });
}

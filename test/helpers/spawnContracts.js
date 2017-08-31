import { TriState, EVERYONE } from "./triState";

const LockedAccount = artifacts.require("LockedAccount");
const EtherToken = artifacts.require("EtherToken");
const Neumark = artifacts.require("Neumark");
const TestCommitment = artifacts.require("TestCommitment");
const WhitelistedCommitment = artifacts.require("WhitelistedCommitment");
const EthereumForkArbiter = artifacts.require("EthereumForkArbiter");
const RoleBasedAccessControl = artifacts.require("RoleBasedAccessControl");

const BigNumber = web3.BigNumber;

/* eslint-disable */
export let neumark;
export let etherToken;
export let lockedAccount;
export let curve;
export let commitment;
export let feePool;
export let accessControl;
export let forkArbiter;

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
  forkArbiter = await EthereumForkArbiter.new(accessControl.address);
  etherToken = await EtherToken.new(accessControl.address);
  // console.log(`\tEtherToken took ${gasCost(etherToken)}.`);
  neumark = await Neumark.new(
    accessControl.address,
    forkArbiter.address,
    "ipfs:QmPXME1oRtoT627YKaDPDQ3PwA8tdP9rWuAAweLzqSwAWT"
  );
  lockedAccount = await LockedAccount.new(
    accessControl.address,
    forkArbiter.address,
    "ipfs:QmPXME1oRtoT627YKaDPDQ3PwA8tdP9rWuAAweLzqSwAWT",
    etherToken.address,
    neumark.address,
    unlockDateMonths * months,
    ether(1).mul(unlockPenalty).round()
  );
  await accessControl.setUserRole(
    lockAdminAccount,
    web3.sha3("LockedAccountAdmin"),
    lockedAccount.address,
    TriState.Allow
  );
  await lockedAccount.setPenaltyDisbursal(operatorWallet, {
    from: lockAdminAccount
  });

  // TODO: Restrict to correct spawened contracts
  await accessControl.setUserRole(
    EVERYONE,
    web3.sha3("SnapshotCreator"),
    neumark.address,
    TriState.Allow
  );
  await accessControl.setUserRole(
    EVERYONE,
    web3.sha3("NeumarkIssuer"),
    neumark.address,
    TriState.Allow
  );
  await accessControl.setUserRole(
    EVERYONE,
    web3.sha3("NeumarkBurner"),
    neumark.address,
    TriState.Allow
  );
  await accessControl.setUserRole(
    EVERYONE,
    web3.sha3("TransferAdmin"),
    neumark.address,
    TriState.Allow
  );
}

export async function spawnPublicCommitment(
  lockAdminAccount,
  startTimestamp,
  duration,
  minAbsCap,
  maxAbsCap,
  minTicket,
  eurEthRate
) {
  commitment = await TestCommitment.new(
    accessControl.address,
    etherToken.address,
    lockedAccount.address,
    neumark.address
  );
  await commitment.setCommitmentTerms(
    startTimestamp,
    startTimestamp + duration,
    minAbsCap,
    maxAbsCap,
    minTicket,
    ether(eurEthRate),
    operatorWallet
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
  minAbsCap,
  maxAbsCap,
  minTicket,
  eurEthRate
) {
  commitment = await WhitelistedCommitment.new(
    accessControl.address,
    etherToken.address,
    lockedAccount.address,
    neumark.address
  );
  await commitment.setCommitmentTerms(
    startTimestamp,
    startTimestamp + duration,
    minAbsCap,
    maxAbsCap,
    minTicket,
    ether(eurEthRate),
    operatorWallet
  );
  // console.log(lockedAccount.setController);
  await accessControl.setUserRole(
    whitelistAdminAccount,
    web3.sha3("WhitelistAdmin"),
    commitment.address,
    TriState.Allow
  );
  await lockedAccount.setController(commitment.address, {
    from: lockAdminAccount
  });
}

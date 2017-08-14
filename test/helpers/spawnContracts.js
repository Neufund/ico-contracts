import gasCost from './gasCost';

const LockedAccount = artifacts.require('LockedAccount');
const EtherToken = artifacts.require('EtherToken');
const NeumarkController = artifacts.require('NeumarkController');
const NeumarkFactory = artifacts.require('NeumarkFactory');
const Neumark = artifacts.require('Neumark');
const Curve = artifacts.require('Curve');
const TestCommitment = artifacts.require('TestCommitment');
const WhitelistedCommitment = artifacts.require('WhitelistedCommitment');
const FeeDistributionPool = artifacts.require('FeeDistributionPool');

const BigNumber = web3.BigNumber

export let neumark;
export let neumarkController;
export let etherToken;
export let lockedAccount;
export let curve;
export let commitment;
export let feePool;
// todo: take from universe
export let operatorWallet = "0x55d7d863a155f75c5139e20dcbda8d0075ba2a1c";

export const days = 24 * 60 * 60;
export const months = 30 * 24 * 60 * 60;
export const ether = wei => ((new BigNumber(wei)).mul(10 ** 18));

export async function spawnLockedAccount(longStopDateMonths, unlockPenalty) {
  etherToken = await EtherToken.new();
  // console.log(`\tEtherToken took ${gasCost(etherToken)}.`);
  const neumarkFactory = await NeumarkFactory.new();
  neumark = await Neumark.new(neumarkFactory.address);
  neumarkController = await NeumarkController.new(neumark.address);
  await neumark.changeController(neumarkController.address);
  curve = await Curve.new(neumarkController.address);
  lockedAccount = await LockedAccount.new(
    etherToken.address,
    curve.address,
    longStopDateMonths * months,
    Math.round(unlockPenalty * ether(1))
  );
  // console.log(`\tLockedAccount took ${gasCost(lockedAccount)}.`);
  feePool = await FeeDistributionPool.new(etherToken.address, neumark.address);
  // console.log(`\FeeDistributionPool took ${gasCost(feePool)}.`);
  await lockedAccount.setPenaltyDistribution(feePool.address);
}

export async function spawnPublicCommitment(startTimestamp, duration, minCommitment, maxCommitment, minTicket, eurEthRate) {
  commitment = await TestCommitment.new(startTimestamp, startTimestamp + duration, minCommitment, maxCommitment,
    minTicket, ether(eurEthRate),
    etherToken.address, lockedAccount.address, curve.address);
  // console.log(lockedAccount.setController);
  await lockedAccount.setController(commitment.address);
}

export async function spawnWhitelistedCommitment(startTimestamp, duration, minCommitment, maxCommitment, minTicket, eurEthRate) {
  commitment = await WhitelistedCommitment.new(startTimestamp, startTimestamp + duration, minCommitment, maxCommitment,
    minTicket, ether(eurEthRate),
    etherToken.address, lockedAccount.address, curve.address);
  // console.log(lockedAccount.setController);
  await lockedAccount.setController(commitment.address);
}

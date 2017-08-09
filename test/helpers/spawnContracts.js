import gasCost from './gasCost';

const LockedAccount = artifacts.require('LockedAccount');
const EtherToken = artifacts.require('EtherToken');
const NeumarkController = artifacts.require('NeumarkController');
const NeumarkFactory = artifacts.require('NeumarkFactory');
const Neumark = artifacts.require('Neumark');
const Curve = artifacts.require('Curve');
const Crowdsale = artifacts.require('Crowdsale');
const FeeDistributionPool = artifacts.require('FeeDistributionPool');

export let neumark;
export let neumarkController;
export let etherToken;
export let lockedAccount;
export let curve;
export let crowdsale;
export let feePool;

export const days = 24 * 60 * 60;
export const months = 30 * 24 * 60 * 60;
export const FP_SCALE = 10000;
export const ether = wei => (wei * 10 ** 18);

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

export async function spawnCrowdsale(startTimestamp, duration, minCap, maxCap) {
  crowdsale = await Crowdsale.new(startTimestamp, startTimestamp + duration, minCap, maxCap,
    etherToken.address, lockedAccount.address, curve.address);
  // console.log(lockedAccount.setController);
  await lockedAccount.setController(crowdsale.address);
}

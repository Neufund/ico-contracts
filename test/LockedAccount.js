import gasCost from './helpers/gasCost';

const LockedAccount = artifacts.require('LockedAccount');
const EtherToken = artifacts.require('EtherToken');
const Neumark = artifacts.require('Neumark');

contract('LockedAccount', (accounts) => {
  let etherToken;
  let neumark;
  let lockedAccount;

  it('should deploy', async () => {
    etherToken = await EtherToken.new();
    console.log(`\tEtherToken took ${gasCost(etherToken)}.`);
    neumark = await Neumark.deployed();
    lockedAccount = await LockedAccount.new(
      etherToken.address,
      neumark.address,
      18 * 30 * 24 * 60 * 60,
      Math.round(0.1 * 10000)
    );
    console.log(`\tLockedAccount took ${gasCost(lockedAccount)}.`);
  });
  it('should be able to read lock parameters', async () => {
    const instance = await LockedAccount.deployed();
    assert.equal(await lockedAccount.totalLockedAmount.call(), 0);
    assert.equal(await lockedAccount.totalInvestors.call(), 0);
    assert.equal(await lockedAccount.ownedToken.call(), etherToken.address);
  });
});

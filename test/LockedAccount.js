const LockedAccount = artifacts.require('LockedAccount');
const EtherToken = artifacts.require('EtherToken');

contract('LockedAccount', (accounts) => {
  it('should be able to read lock parameters', async () => {
    const instance = await LockedAccount.deployed();
    assert.equal(await instance.totalLockedAmount.call(), 0);
    assert.equal(await instance.totalInvestors.call(), 0);
    assert.equal(await instance.ownedToken.call(), EtherToken.address);
  });
});

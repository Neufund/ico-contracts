const Neumark = artifacts.require('./Neumark.sol');
const NeumarkController = artifacts.require('./NeumarkController.sol');

contract('Neumark', (accounts) => {
  it('should have name Neumark, symbol NMK and 38 decimals', async () => {
    const instance = await Neumark.deployed();
    assert.equal(await instance.name.call(), 'Neumark');
    assert.equal(await instance.symbol.call(), 'NMK');
    assert.equal(await instance.decimals.call(), 38);
  });
  it('should not have accounts[0] as controller ', async () => {
    const instance = await Neumark.deployed();
    assert.notEqual(await instance.controller.call(), accounts[0]);
  });
  it('should have NeumarkController as controller', async () => {
    const instance = await Neumark.deployed();
    assert.equal(await instance.controller.call(), NeumarkController.address);
  });
  it('should start at zero', async () => {
    const instance = await Neumark.deployed();
    assert.equal(await instance.totalSupply.call(), 0);
    assert.equal(await instance.balanceOf.call(accounts[0]), 0);
  });

  it('should allow controller to generate tokens', async () => {
    const neumark = await Neumark.deployed();
    const controller = await NeumarkController.deployed();
    assert(await controller.generateTokens(accounts[0], 10000, { from: accounts[0] }));
    assert.equal(await neumark.totalSupply.call(), 10000, "10000 wasn't the total");
    assert.equal(
      await neumark.balanceOf.call(accounts[0]),
      10000,
      "10000 wasn't in the first account"
    );
  });

  it('should put 10000 MetaCoin in the first account', async () => {
    const instance = await Neumark.deployed();
    const balance = await instance.balanceOf.call(accounts[0]);
    assert.equal(balance.valueOf(), 10000, "10000 wasn't in the first account");
  });
});

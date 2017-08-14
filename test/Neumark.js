import gasCost from './helpers/gasCost';

const NeumarkFactory = artifacts.require('./NeumarkFactory.sol');
const Neumark = artifacts.require('./Neumark.sol');
const NeumarkController = artifacts.require('./NeumarkController.sol');

contract('Neumark', (accounts) => {
  let neumark;
  let factory;
  let controller;

  beforeEach(async () => {
    factory = await NeumarkFactory.new();
    neumark = await Neumark.new(factory.address);
    controller = await NeumarkController.new(neumark.address);
    await neumark.changeController(controller.address);
  });

  it('should deploy', async () => {
    console.log(`\tFactory took ${gasCost(factory)}.`);
    console.log(`\tNeumark took ${gasCost(neumark)}.`);
    console.log(`\tController took ${gasCost(controller)}.`);
  });
  it('should have name Neumark, symbol NMK and no decimals', async () => {
    assert.equal(await neumark.name.call(), 'Neumark');
    assert.equal(await neumark.symbol.call(), 'NMK');
    assert.equal(await neumark.decimals.call(), 18);
  });
  it('should not have accounts[0] as controller ', async () => {
    assert.notEqual(await neumark.controller.call(), accounts[0]);
  });
  it('should have NeumarkController as controller', async () => {
    assert.equal(await neumark.controller.call(), controller.address);
  });
  it('should start at zero', async () => {
    assert.equal(await neumark.totalSupply.call(), 0);
    assert.equal(await neumark.balanceOf.call(accounts[0]), 0);
  });

  it('should allow controller to generate tokens', async () => {
    assert(await controller.generateTokens(accounts[0], 10000, { from: accounts[0] }));
    assert.equal(await neumark.totalSupply.call(), 10000, "10000 wasn't the total");
    assert.equal(
      await neumark.balanceOf.call(accounts[0]),
      10000,
      "10000 wasn't in the first account"
    );
  });
});

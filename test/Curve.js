import gasCost from './helpers/gasCost';

const Curve = artifacts.require('./Curve.sol');
const NeumarkFactory = artifacts.require('./NeumarkFactory.sol');
const Neumark = artifacts.require('./Neumark.sol');
const NeumarkController = artifacts.require('./NeumarkController.sol');

contract('Curve', (accounts) => {
  let curve;
  let neumark;
  let factory;
  let controller;

  beforeEach(async () => {
    factory = await NeumarkFactory.new();
    neumark = await Neumark.new(factory.address);
    controller = await NeumarkController.new(neumark.address);
    await neumark.changeController(controller.address);
    curve = await Curve.new(controller.address);
  });

  it('should deploy', async () => {
    console.log(`\tCurve took ${gasCost(curve)}.`);
  });
  it('should start at zero', async () => {
    assert.equal(await curve.totalEuros.call(), 0);
  });
  it('should compute exactly over the whole range', async () => {
    const correct = [
      [0, 0],
      [1, 6],
      [2, 12],
      [3, 19],
      [4, 25],
      [5, 32],
      [6, 38],
      [7, 45],
      [8, 51],
      [9, 58],
      [10, 64],
      [20, 129],
      [30, 194],
      [40, 259],
      [50, 324],
      [60, 389],
      [70, 454],
      [80, 519],
      [90, 584],
      [100, 649],
      [200, 1299],
      [300, 1949],
      [400, 2599],
      [500, 3249],
      [600, 3899],
      [700, 4549],
      [800, 5199],
      [900, 5849],
      [1000, 6499],
      [2000, 12999],
      [3000, 19499],
      [4000, 25999],
      [5000, 32499],
      [6000, 38999],
      [7000, 45499],
      [8000, 51999],
      [9000, 58498],
      [10000, 64998],
      [20000, 129994],
      [30000, 194987],
      [40000, 259977],
      [50000, 324964],
      [60000, 389949],
      [70000, 454930],
      [80000, 519909],
      [90000, 584885],
      [100000, 649859],
      [200000, 1299436],
      [300000, 1948733],
      [400000, 2597747],
      [500000, 3246481],
      [600000, 3894934],
      [700000, 4543106],
      [800000, 5190997],
      [900000, 5838607],
      [1000000, 6485936],
      [2000000, 12943829],
      [3000000, 19373797],
      [4000000, 25775962],
      [5000000, 32150445],
      [6000000, 38497365],
      [7000000, 44816841],
      [8000000, 51108992],
      [9000000, 57373936],
      [10000000, 63611790],
      [20000000, 124525941],
      [30000000, 182856853],
      [40000000, 238714076],
      [50000000, 292202513],
      [60000000, 343422621],
      [70000000, 392470593],
      [80000000, 439438546],
      [90000000, 484414688],
      [100000000, 527483488],
      [200000000, 869474423],
      [300000000, 1091202310],
      [400000000, 1234958331],
      [500000000, 1328161734],
      [600000000, 1388589632],
      [700000000, 1427767718],
      [800000000, 1453168609],
      [900000000, 1469637132],
      [1000000000, 1480314406],
      [1100000000, 1487236957],
      [1200000000, 1491725153],
      [1300000000, 1494635050],
      [1400000000, 1496521665],
      [1500000000, 1497744841],
      [1600000000, 1497744841],
      [1700000000, 1497744841],
      [1800000000, 1497744841],
      [1900000000, 1497744841],
    ];
    await Promise.all(
      correct.map(async ([i, v]) => {
        const r = (await curve.curve.call(i)).valueOf();
        assert.equal(r, v, `Curve compute failed for value ${i}`);
      })
    );
  });
  it('should issue Neumarks', async () => {
    assert.equal((await curve.totalEuros.call()).valueOf(), 0);
    assert.equal((await neumark.totalSupply.call()).valueOf(), 0);

    const r1 = await curve.issue(100, accounts[1]); // TODO check result
    console.log(`\tIssue took ${gasCost(r1)}.`);
    assert.equal((await curve.totalEuros.call()).valueOf(), 100);
    assert.equal((await neumark.totalSupply.call()).valueOf(), 649);
    assert.equal((await neumark.balanceOf.call(accounts[1])).valueOf(), 649);

    const r2 = await curve.issue(900, accounts[2]);
    console.log(`\tIssue took ${gasCost(r2)}.`);
    assert.equal((await curve.totalEuros.call()).valueOf(), 1000);
    assert.equal((await neumark.totalSupply.call()).valueOf(), 6499);
    assert.equal((await neumark.balanceOf.call(accounts[2])).valueOf(), 6499 - 649);
  });
  it('should issue and then burn Neumarks', async () => {
    const r = await curve.issue(100, accounts[1]);
    console.log(`\tIssue took ${gasCost(r)}.`);
    const neumarks = (await neumark.balanceOf.call(accounts[1])).valueOf();
    const burned = await curve.burnNeumark(neumarks, accounts[1]);
    console.log(`\tBurn took ${gasCost(burned)}.`);
    assert.equal((await neumark.balanceOf.call(accounts[1])).valueOf(), 0);
  });
});

import gasCost from "./helpers/gasCost";

const Neumark = artifacts.require("./Neumark.sol");

contract("Neumark", accounts => {
  let neumark;

  beforeEach(async () => {
    neumark = await Neumark.new();
  });

  it("should deploy", async () => {
    console.log(`\tNeumark took ${gasCost(neumark)}.`);
  });
  it("should have name Neumark, symbol NMK and 18 decimals", async () => {
    assert.equal(await neumark.name.call(), "Neumark");
    assert.equal(await neumark.symbol.call(), "NMK");
    assert.equal(await neumark.decimals.call(), 18);
  });
  it("should start at zero", async () => {
    assert.equal(await neumark.totalSupply.call(), 0);
    assert.equal(await neumark.balanceOf.call(accounts[0]), 0);
  });

  it("should generate tokens", async () => {
    assert(
      await neumark.generateTokens(accounts[0], 10000, { from: accounts[0] })
    );
    assert.equal(
      await neumark.totalSupply.call(),
      10000,
      "10000 wasn't the total"
    );
    assert.equal(
      await neumark.balanceOf.call(accounts[0]),
      10000,
      "10000 wasn't in the first account"
    );
  });

  it("should burn tokens", async () => {
    assert(
      await neumark.generateTokens(accounts[0], 10000, { from: accounts[0] })
    );
    assert(
      await neumark.destroyTokens(accounts[0], 1000, { from: accounts[0] })
    );
    assert.equal(await neumark.totalSupply.call(), 9000);
    assert.equal(await neumark.balanceOf.call(accounts[0]), 9000);
  });
});

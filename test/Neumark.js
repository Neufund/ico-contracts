import { expect } from "chai";
import { prettyPrintGasCost } from "./helpers/gasUtils";
import { eventValue } from "./helpers/events";
import createAccessPolicy from "./helpers/createAccessPolicy";
import roles from "./helpers/roles";
import { saveBlockchain, restoreBlockchain } from "./helpers/evmCommands";

const EthereumForkArbiter = artifacts.require("EthereumForkArbiter");
const Neumark = artifacts.require("./Neumark.sol");

const BigNumber = web3.BigNumber;
const AGREEMENT = "ipfs:QmPXME1oRtoT627YKaDPDQ3PwA8tdP9rWuAAweLzqSwAWT";
const EUR_DECIMALS = new BigNumber(10).toPower(18);
const NMK_DECIMALS = new BigNumber(10).toPower(18);

contract("Neumark", accounts => {
  let snapshot;
  let rbac;
  let forkArbiter;
  let neumark;

  before(async () => {
    rbac = await createAccessPolicy([
      { subject: accounts[0], role: roles.transferAdmin },
      { subject: accounts[0], role: roles.neumarkIssuer },
      { subject: accounts[1], role: roles.neumarkIssuer },
      { subject: accounts[2], role: roles.neumarkIssuer },
      { subject: accounts[0], role: roles.neumarkBurner },
      { subject: accounts[1], role: roles.neumarkBurner },
      { subject: accounts[0], role: roles.platformOperatorRepresentative }
    ]);
    forkArbiter = await EthereumForkArbiter.new(rbac.address);
    neumark = await Neumark.new(rbac.address, forkArbiter.address);
    await neumark.amendAgreement(AGREEMENT);
    snapshot = await saveBlockchain();
  });

  beforeEach(async () => {
    await restoreBlockchain(snapshot);
    snapshot = await saveBlockchain();
  });

  it("should deploy", async () => {
    await prettyPrintGasCost("Neumark deploy", neumark);
  });

  it("should have agreement and fork arbiter", async () => {
    const actualAgreement = await neumark.currentAgreement.call();
    const actualForkArbiter = await neumark.ethereumForkArbiter.call();

    expect(actualAgreement[2]).to.equal(AGREEMENT);
    expect(actualForkArbiter).to.equal(forkArbiter.address);
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

  it("should issue Neumarks", async () => {
    assert.equal((await neumark.totalEuroUlps.call()).valueOf(), 0);
    assert.equal((await neumark.totalSupply.call()).valueOf(), 0);

    const r1 = await neumark.issueForEuro(EUR_DECIMALS.mul(100), {
      from: accounts[1]
    }); // TODO check result
    await prettyPrintGasCost("Issue", r1);
    assert.equal(
      (await neumark.totalEuroUlps.call()).div(NMK_DECIMALS).floor().valueOf(),
      100
    );
    assert.equal(
      (await neumark.totalSupply.call()).div(NMK_DECIMALS).floor().valueOf(),
      649
    );
    assert.equal(
      (await neumark.balanceOf.call(accounts[1]))
        .div(NMK_DECIMALS)
        .floor()
        .valueOf(),
      649
    );

    const r2 = await neumark.issueForEuro(EUR_DECIMALS.mul(900), {
      from: accounts[2]
    });
    await prettyPrintGasCost("Issue", r2);
    assert.equal(
      (await neumark.totalEuroUlps.call()).div(NMK_DECIMALS).floor().valueOf(),
      1000
    );
    assert.equal(
      (await neumark.totalSupply.call()).div(NMK_DECIMALS).floor().valueOf(),
      6499
    );
    assert.equal(
      (await neumark.balanceOf.call(accounts[2]))
        .div(NMK_DECIMALS)
        .floor()
        .valueOf(),
      5849
    );
  });

  it("should issue and then burn Neumarks", async () => {
    // Issue Neumarks for 1 mln Euros
    const euroUlps = EUR_DECIMALS.mul(1000000);
    const r = await neumark.issueForEuro(euroUlps, { from: accounts[1] });
    await prettyPrintGasCost("Issue", r);
    const neumarkUlps = await neumark.balanceOf.call(accounts[1]);
    const neumarks = neumarkUlps.div(NMK_DECIMALS).floor().valueOf();

    // Burn a third the Neumarks
    const toBurn = Math.floor(neumarks / 3);
    const toBurnUlps = NMK_DECIMALS.mul(toBurn);
    const burned = await neumark.burnNeumark(toBurnUlps, { from: accounts[1] });
    await prettyPrintGasCost("Burn", burned);
    assert.equal(
      (await neumark.balanceOf.call(accounts[1]))
        .div(NMK_DECIMALS)
        .floor()
        .valueOf(),
      neumarks - toBurn
    );
  });

  it("should issue same amount in multiple issuances", async () => {
    // 1 ether + 100 wei in eur
    const eurRate = 218.1192809;
    const euroUlps = EUR_DECIMALS.mul(1).add(100).mul(eurRate);
    const totNMK = await neumark.cumulative(euroUlps);
    // issue for 1 ether
    const euro1EthUlps = EUR_DECIMALS.mul(1).mul(eurRate);
    let tx = await neumark.issueForEuro(euro1EthUlps);
    const p1NMK = eventValue(tx, "LogNeumarksIssued", "neumarkUlp");
    // issue for 100 wei
    tx = await neumark.issueForEuro(new BigNumber(100).mul(eurRate));
    const p2NMK = eventValue(tx, "LogNeumarksIssued", "neumarkUlp");
    expect(totNMK).to.be.bignumber.equal(p1NMK.plus(p2NMK));
  });

  it("should transfer Neumarks", async () => {
    const from = accounts[1];
    await neumark.issueForEuro(EUR_DECIMALS.mul(100), { from });
    const amount = await neumark.balanceOf.call(accounts[1]);
    await neumark.enableTransfer(true);

    const tx = await neumark.transfer(accounts[3], amount, { from });
    const balance1 = await neumark.balanceOf.call(accounts[1]);
    const balance3 = await neumark.balanceOf.call(accounts[3]);

    await prettyPrintGasCost("Transfer", tx);
    expect(amount).to.be.bignumber.not.equal(0);
    expect(balance1).to.be.bignumber.equal(0);
    expect(balance3).to.be.bignumber.equal(amount);
  });

  it("should accept agreement on issue Neumarks", async () => {
    const from = accounts[1];
    const tx = await neumark.issueForEuro(EUR_DECIMALS.mul(100), { from });

    const agreements = tx.logs
      .filter(e => e.event === "LogAgreementAccepted")
      .map(({ args: { accepter } }) => accepter);
    expect(agreements).to.have.length(1);
    expect(agreements).to.contain(from);
    const isSigned = await neumark.isAgreementSignedBy.call(from);
    expect(isSigned).to.be.true;
  });

  it("should accept agreement on transfer", async () => {
    const issuer = accounts[0];
    const from = accounts[2];
    const to = accounts[3];
    await neumark.issueForEuro(EUR_DECIMALS.mul(100), { from: issuer });
    const amount = await neumark.balanceOf.call(issuer);
    await neumark.enableTransfer(true);
    // 'from' address will not be passively signed up here
    await neumark.transfer(from, amount, { from: issuer });

    // 'from' is making first transaction over Neumark, this will sign it up
    const tx = await neumark.transfer(to, amount, { from });
    const agreements = tx.logs
      .filter(e => e.event === "LogAgreementAccepted")
      .map(({ args: { accepter } }) => accepter);
    expect(agreements).to.have.length(1);
    expect(agreements).to.contain(from);
    const isFromSigned = await neumark.isAgreementSignedBy.call(from);
    expect(isFromSigned).to.be.true;
    // 'to' should not be passively signed
    const isToSigned = await neumark.isAgreementSignedBy.call(to);
    expect(isToSigned).to.be.false;
  });

  it("should accept agreement on approve", async () => {
    const issuer = accounts[0];
    const to = accounts[3];
    await neumark.issueForEuro(EUR_DECIMALS.mul(100), { from: issuer });
    const amount = await neumark.balanceOf.call(issuer);
    await neumark.enableTransfer(true);
    // 'to' address will not be passively signed up here
    await neumark.transfer(to, amount, { from: issuer });

    // 'from' is making first transaction over Neumark, this will sign it up
    const tx = await neumark.approve(accounts[1], amount, { from: to });
    const agreements = tx.logs
      .filter(e => e.event === "LogAgreementAccepted")
      .map(({ args: { accepter } }) => accepter);
    expect(agreements).to.have.length(1);
    expect(agreements).to.contain(to);
    const isToSigned = await neumark.isAgreementSignedBy.call(to);
    expect(isToSigned).to.be.true;
  });

  it("should transfer Neumarks only when enabled", async () => {
    const from = accounts[1];
    await neumark.issueForEuro(EUR_DECIMALS.mul(100), { from });
    const amount = await neumark.balanceOf.call(accounts[1]);
    await neumark.enableTransfer(false);

    const tx = neumark.transfer(accounts[3], amount, { from });

    await expect(tx).to.revert;
  });
});

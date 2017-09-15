import { expect } from "chai";
import createAccessPolicy from "./helpers/createAccessPolicy";
import forceEther from "./helpers/forceEther";
import roles from "./helpers/roles";
import {
  promisify,
  saveBlockchain,
  restoreBlockchain
} from "./helpers/evmCommands";

const TestReclaimable = artifacts.require("TestReclaimable");
const TestToken = artifacts.require("TestToken");

contract("Reclaimable", ([deployer, reclaimer, other]) => {
  let snapshot;
  let reclaimable;
  const RECLAIM_ETHER = "0x0";

  beforeEach(async () => {
    const accessPolicy = await createAccessPolicy([
      { subject: reclaimer, role: roles.reclaimer }
    ]);
    reclaimable = await TestReclaimable.new(accessPolicy.address);
    snapshot = await saveBlockchain();
  });

  beforeEach(async () => {
    await restoreBlockchain(snapshot);
    snapshot = await saveBlockchain();
  });

  it("should reclaim ether", async () => {
    const amount = web3.toWei(1, "ether");

    await forceEther(reclaimable.address, amount, deployer);
    const reclaimerBefore = await promisify(web3.eth.getBalance)(reclaimer);
    const before = await promisify(web3.eth.getBalance)(reclaimable.address);
    await reclaimable.reclaim(RECLAIM_ETHER, { from: reclaimer });
    const after = await promisify(web3.eth.getBalance)(reclaimable.address);
    const reclaimerAfter = await promisify(web3.eth.getBalance)(reclaimer);

    expect(before).to.be.bignumber.equal(amount);
    expect(after).to.be.bignumber.zero;

    // The reclaimer also pays for gas.
    expect(reclaimerAfter.comparedTo(reclaimerBefore)).to.equal(1);
  });

  it("should reclaim tokens", async () => {
    const amount = web3.toWei(1, "ether");
    const token = await TestToken.new(amount);
    await token.transfer(reclaimable.address, amount);
    const reclaimerBefore = await token.balanceOf.call(reclaimer);
    const before = await token.balanceOf.call(reclaimable.address);
    await reclaimable.reclaim(token.address, { from: reclaimer });
    const after = await token.balanceOf.call(reclaimable.address);
    const reclaimerAfter = await token.balanceOf.call(reclaimer);

    expect(before).to.be.bignumber.equal(amount);
    expect(after).to.be.bignumber.zero;
    expect(reclaimerAfter.sub(reclaimerBefore)).to.be.bignumber.equal(amount);
  });

  it("should only allow ROLE_RECLAIMER to reclaim", async () => {
    const amount = web3.toWei(1, "ether");
    await forceEther(reclaimable.address, amount, deployer);
    await expect(reclaimable.reclaim(RECLAIM_ETHER, { from: other })).to.revert;
    await expect(reclaimable.reclaim(RECLAIM_ETHER, { from: deployer })).to
      .revert;
    await expect(reclaimable.reclaim(RECLAIM_ETHER, { from: reclaimer })).to.not
      .revert;
  });
});

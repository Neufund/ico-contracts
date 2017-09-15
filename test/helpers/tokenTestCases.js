import { expect } from "chai";
import { eventValue } from "./events";
import EvmError from "./EVMThrow";

export function basicTokenTests(token, fromAddr, toAddr, initialBalance) {

  function expectTransferEvent(tx, from, to, amount) {
    const event = eventValue(tx, "Transfer");
    expect(event).to.exist;
    expect(event.args.from).to.eq(from);
    expect(event.args.to).to.eq(to);
    expect(event.args.amount).to.be.bignumber.eq(amount);
  }

  it("should return the correct totalSupply", async function() {
    const totalSupply = await token().totalSupply.call();
    expect(totalSupply).to.be.bignumber.eq(initialBalance);
  });

  it("should return correct balances after transfer", async function() {
    // before transfer
    const fromAddrBalanceInitial = await token().balanceOf.call(fromAddr);
    expect(fromAddrBalanceInitial).to.be.bignumber.eq(initialBalance);
    // transfer all
    const tx = await token().transfer(toAddr, initialBalance, { from: fromAddr });
    expectTransferEvent(tx, fromAddr, toAddr, initialBalance);
    // check balances
    const fromAddrBalance = await token().balanceOf.call(fromAddr);
    expect(fromAddrBalance).to.be.bignumber.eq(0);
    const toAddrBalance = await token().balanceOf.call(toAddr);
    expect(toAddrBalance).to.be.bignumber.eq(initialBalance);
    // total supply should not change
    const totalSupply = await token().totalSupply.call();
    expect(totalSupply).to.be.bignumber.eq(initialBalance);
  });

  it('should throw an error when trying to transfer more than balance', async function() {
    await expect(
      token().transfer(toAddr, initialBalance + 1, { from: fromAddr })
    ).to.be.rejectedWith(EvmError);
  });

  it('should throw an error when trying to transfer to 0x0', async function() {
    await expect(
      token().transfer(0x0, initialBalance, { from: fromAddr })
    ).to.be.rejectedWith(EvmError);
  });

}

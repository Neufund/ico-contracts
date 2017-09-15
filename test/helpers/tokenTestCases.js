import { expect } from "chai";
import { eventValue } from "./events";
import EvmError from "./EVMThrow";

function expectTransferEvent(tx, from, to, amount) {
  const event = eventValue(tx, "Transfer");
  expect(event).to.exist;
  expect(event.args.from).to.eq(from);
  expect(event.args.to).to.eq(to);
  expect(event.args.amount).to.be.bignumber.eq(amount);
}

function expectApproveEvent(tx, owner, spender, amount) {
  const event = eventValue(tx, "Approval");
  expect(event).to.exist;
  expect(event.args.owner).to.eq(owner);
  expect(event.args.spender).to.eq(spender);
  expect(event.args.amount).to.be.bignumber.eq(amount);
}

export function basicTokenTests(token, fromAddr, toAddr, initialBalance) {
  it("should return the correct totalSupply", async () => {
    const totalSupply = await token().totalSupply.call();
    expect(totalSupply).to.be.bignumber.eq(initialBalance);
  });

  it("should return correct balances after transfer", async () => {
    // before transfer
    const fromAddrBalanceInitial = await token().balanceOf.call(fromAddr);
    expect(fromAddrBalanceInitial).to.be.bignumber.eq(initialBalance);
    // transfer all
    const tx = await token().transfer(toAddr, initialBalance, {
      from: fromAddr
    });
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

  it("should throw an error when trying to transfer more than balance", async () => {
    const balance = await token().balanceOf.call(fromAddr);
    expect(balance).to.be.bignumber.eq(initialBalance);
    await expect(
      token().transfer(toAddr, initialBalance.add(1), { from: fromAddr })
    ).to.be.rejectedWith(EvmError);
  });

  it("should throw an error when trying to transfer to 0x0", async () => {
    await expect(
      token().transfer(0x0, initialBalance, { from: fromAddr })
    ).to.be.rejectedWith(EvmError);
  });
}

export function standardTokenTests(
  token,
  fromAddr,
  toAddr,
  thirdParty,
  initialBalance
) {
  it("should check totalSupply and initalBalance", async () => {
    const totalSupply = await token().totalSupply.call();
    expect(totalSupply).to.be.bignumber.eq(initialBalance);
    const balance = await token().balanceOf.call(fromAddr);
    expect(balance).to.be.bignumber.eq(initialBalance);
  });

  it("should return the correct allowance amount after approval", async () => {
    const tx = await token().approve(toAddr, initialBalance, {
      from: fromAddr
    });
    expectApproveEvent(tx, fromAddr, toAddr, initialBalance);
    const allowance = await token().allowance.call(fromAddr, toAddr);
    expect(allowance).to.be.bignumber.eq(initialBalance);
  });

  it("should allow approval higher than balance", async () => {
    const amount = initialBalance.mul(2);
    const tx = await token().approve(toAddr, amount, { from: fromAddr });
    expectApproveEvent(tx, fromAddr, toAddr, amount);
    const allowance = await token().allowance.call(fromAddr, toAddr);
    expect(allowance).to.be.bignumber.eq(amount);
  });

  it("should reject changing approval amount", async () => {
    await token().approve(toAddr, initialBalance, { from: fromAddr });
    await expect(
      token().approve(toAddr, 100, { from: fromAddr })
    ).to.be.rejectedWith(EvmError);
  });

  it("should allow re-setting approval amount", async () => {
    await token().approve(toAddr, initialBalance, { from: fromAddr });
    await token().approve(toAddr, 0, { from: fromAddr });
    const amount = initialBalance.mul(0.912381872).round();
    const tx = await token().approve(toAddr, amount, { from: fromAddr });
    expectApproveEvent(tx, fromAddr, toAddr, amount);
    const allowance = await token().allowance.call(fromAddr, toAddr);
    expect(allowance).to.be.bignumber.eq(amount);
  });

  it("should return the 0 allowance amount without approval", async () => {
    const tx = await token().approve(toAddr, initialBalance, {
      from: fromAddr
    });
    expectApproveEvent(tx, fromAddr, toAddr, initialBalance);
    // mind reversing spender and owner
    const allowance = await token().allowance.call(toAddr, fromAddr);
    expect(allowance).to.be.bignumber.eq(0);
  });

  it("should return correct balances after transferFrom", async () => {
    await token().approve(toAddr, initialBalance, { from: fromAddr });
    // transfer
    const tx = await token().transferFrom(
      fromAddr,
      thirdParty,
      initialBalance,
      { from: toAddr }
    );
    expectTransferEvent(tx, fromAddr, thirdParty, initialBalance);
    // check balances
    const balanceFrom = await token().balanceOf.call(fromAddr);
    expect(balanceFrom).to.be.bignumber.eq(0);
    const balanceThird = await token().balanceOf.call(thirdParty);
    expect(balanceThird).to.be.bignumber.eq(initialBalance);
    const balanceTo = await token().balanceOf.call(toAddr);
    expect(balanceTo).to.be.bignumber.eq(0);
    // total supply should not change
    const totalSupply = await token().totalSupply.call();
    expect(totalSupply).to.be.bignumber.eq(initialBalance);
    // allowance should be 0
    const finalAllowance = await token().allowance.call(fromAddr, toAddr);
    expect(finalAllowance).to.be.bignumber.eq(0);
  });

  it("should return correct balances after transferring part of approval", async () => {
    await token().approve(toAddr, initialBalance, { from: fromAddr });
    const amount = initialBalance.mul(0.87162378).round();
    // transfer amount
    const tx = await token().transferFrom(fromAddr, thirdParty, amount, {
      from: toAddr
    });
    expectTransferEvent(tx, fromAddr, thirdParty, amount);
    // check balances
    const balanceFrom = await token().balanceOf.call(fromAddr);
    expect(balanceFrom).to.be.bignumber.eq(initialBalance.sub(amount));
    const balanceThird = await token().balanceOf.call(thirdParty);
    expect(balanceThird).to.be.bignumber.eq(amount);
    const balanceTo = await token().balanceOf.call(toAddr);
    expect(balanceTo).to.be.bignumber.eq(0);
    // total supply should not change
    const totalSupply = await token().totalSupply.call();
    expect(totalSupply).to.be.bignumber.eq(initialBalance);
    // allowance should be remaining amount
    const finalAllowance = await token().allowance.call(fromAddr, toAddr);
    expect(finalAllowance).to.be.bignumber.eq(initialBalance.sub(amount));
  });

  it("should return correct balances after transferring approval in tranches", async () => {
    await token().approve(toAddr, initialBalance, { from: fromAddr });
    const tranche1 = initialBalance.mul(0.7182).round();
    const tranche2 = initialBalance.sub(tranche1).mul(0.1189273).round();
    const tranche3 = initialBalance.sub(tranche1.add(tranche2));
    // transfer in tranches
    const tx1 = await token().transferFrom(fromAddr, thirdParty, tranche1, {
      from: toAddr
    });
    expectTransferEvent(tx1, fromAddr, thirdParty, tranche1);
    const tx2 = await token().transferFrom(fromAddr, thirdParty, tranche2, {
      from: toAddr
    });
    expectTransferEvent(tx2, fromAddr, thirdParty, tranche2);
    const tx3 = await token().transferFrom(fromAddr, thirdParty, tranche3, {
      from: toAddr
    });
    expectTransferEvent(tx3, fromAddr, thirdParty, tranche3);
    // we transfered whole amount so:
    const balanceFrom = await token().balanceOf.call(fromAddr);
    expect(balanceFrom).to.be.bignumber.eq(0);
    const balanceThird = await token().balanceOf.call(thirdParty);
    expect(balanceThird).to.be.bignumber.eq(initialBalance);
    const balanceTo = await token().balanceOf.call(toAddr);
    expect(balanceTo).to.be.bignumber.eq(0);
    // total supply should not change
    const totalSupply = await token().totalSupply.call();
    expect(totalSupply).to.be.bignumber.eq(initialBalance);
    // allowance should be 0
    const finalAllowance = await token().allowance.call(fromAddr, toAddr);
    expect(finalAllowance).to.be.bignumber.eq(0);
  });

  it("should reject transferFrom if above approval", async () => {
    const amount = initialBalance.mul(0.281972).round();
    await token().approve(toAddr, amount, { from: fromAddr });
    // transfer more than amount but within balance
    await expect(
      token().transferFrom(fromAddr, thirdParty, initialBalance, {
        from: toAddr
      })
    ).to.be.rejectedWith(EvmError);
  });

  it("should reject transferFrom if above balance", async () => {
    const amount = initialBalance.mul(1.281972).round();
    await token().approve(toAddr, amount, { from: fromAddr });
    // transfer amount that is over balance
    await expect(
      token().transferFrom(fromAddr, thirdParty, amount, { from: toAddr })
    ).to.be.rejectedWith(EvmError);
  });

  it("should throw an error when trying to transferFrom to 0x0", async () => {
    await token().approve(toAddr, initialBalance, { from: fromAddr });
    await expect(
      token().transferFrom(fromAddr, 0x0, initialBalance, { from: toAddr })
    ).to.be.rejectedWith(EvmError);
  });
}

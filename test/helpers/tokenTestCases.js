import { expect } from "chai";
import { eventValue } from "./events";
import EvmError from "./EVMThrow";

const TestERC677Callback = artifacts.require("TestERC677Callback");
const TestERC223Callback = artifacts.require("TestERC223Callback");
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export function expectTransferEvent(tx, from, to, amount) {
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

function expectWithdrawEvent(tx, owner, amount) {
  const event = eventValue(tx, "LogWithdrawal");
  expect(event).to.exist;
  expect(event.args.from).to.eq(owner);
  expect(event.args.amount).to.be.bignumber.eq(amount);
}

export async function deployTestErc677Callback() {
  return TestERC677Callback.new();
}

async function deployTestErc223Callback() {
  return TestERC223Callback.new();
}

export function basicTokenTests(token, fromAddr, toAddr, initialBalance) {
  it("should return the correct totalSupply", async () => {
    const totalSupply = await token().totalSupply.call();
    expect(totalSupply).to.be.bignumber.eq(initialBalance);
  });

  it("should return correct balances after transfer of whole balance", async () => {
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

  it("should return correct balances after transfer of amount of 0", async () => {
    // transfer all
    const tx = await token().transfer(toAddr, 0, {
      from: fromAddr
    });
    expectTransferEvent(tx, fromAddr, toAddr, 0);
    // check balances
    const fromAddrBalance = await token().balanceOf.call(fromAddr);
    expect(fromAddrBalance).to.be.bignumber.eq(initialBalance);
    const toAddrBalance = await token().balanceOf.call(toAddr);
    expect(toAddrBalance).to.be.bignumber.eq(0);
  });

  it("should throw an error when trying to transfer 1 'wei' more than balance", async () => {
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
  broker,
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

  it("should return correct balances after transferFrom of whole balance", async () => {
    await token().approve(broker, initialBalance, { from: fromAddr });
    // transfer
    const tx = await token().transferFrom(fromAddr, toAddr, initialBalance, {
      from: broker
    });
    expectTransferEvent(tx, fromAddr, toAddr, initialBalance);
    // check balances
    const balanceFrom = await token().balanceOf.call(fromAddr);
    expect(balanceFrom).to.be.bignumber.eq(0);
    const balanceThird = await token().balanceOf.call(toAddr);
    expect(balanceThird).to.be.bignumber.eq(initialBalance);
    const balanceTo = await token().balanceOf.call(broker);
    expect(balanceTo).to.be.bignumber.eq(0);
    // total supply should not change
    const totalSupply = await token().totalSupply.call();
    expect(totalSupply).to.be.bignumber.eq(initialBalance);
    // allowance should be 0
    const finalAllowance = await token().allowance.call(fromAddr, broker);
    expect(finalAllowance).to.be.bignumber.eq(0);
  });

  it("should return correct balances after approve and transferFrom of 0 amount", async () => {
    await token().approve(broker, 0, { from: fromAddr });
    // transfer
    const tx = await token().transferFrom(fromAddr, toAddr, 0, {
      from: broker
    });
    expectTransferEvent(tx, fromAddr, toAddr, 0);
    // check balances
    const balanceFrom = await token().balanceOf.call(fromAddr);
    expect(balanceFrom).to.be.bignumber.eq(initialBalance);
    const balanceThird = await token().balanceOf.call(toAddr);
    expect(balanceThird).to.be.bignumber.eq(0);
    // allowance should be 0
    const finalAllowance = await token().allowance.call(fromAddr, broker);
    expect(finalAllowance).to.be.bignumber.eq(0);
  });

  it("should return correct balances after approve of whole balance and transferFrom of 0 amount", async () => {
    await token().approve(broker, initialBalance, { from: fromAddr });
    // transfer
    const tx = await token().transferFrom(fromAddr, toAddr, 0, {
      from: broker
    });
    expectTransferEvent(tx, fromAddr, toAddr, 0);
    // check balances
    const balanceFrom = await token().balanceOf.call(fromAddr);
    expect(balanceFrom).to.be.bignumber.eq(initialBalance);
    const balanceThird = await token().balanceOf.call(toAddr);
    expect(balanceThird).to.be.bignumber.eq(0);
    // allowance should be 0
    const finalAllowance = await token().allowance.call(fromAddr, broker);
    expect(finalAllowance).to.be.bignumber.eq(initialBalance);
  });

  it("should return correct balances after transferring part of approval", async () => {
    await token().approve(broker, initialBalance, { from: fromAddr });
    const amount = initialBalance.mul(0.87162378).round();
    // transfer amount
    const tx = await token().transferFrom(fromAddr, toAddr, amount, {
      from: broker
    });
    expectTransferEvent(tx, fromAddr, toAddr, amount);
    // check balances
    const balanceFrom = await token().balanceOf.call(fromAddr);
    expect(balanceFrom).to.be.bignumber.eq(initialBalance.sub(amount));
    const balanceThird = await token().balanceOf.call(toAddr);
    expect(balanceThird).to.be.bignumber.eq(amount);
    const balanceTo = await token().balanceOf.call(broker);
    expect(balanceTo).to.be.bignumber.eq(0);
    // total supply should not change
    const totalSupply = await token().totalSupply.call();
    expect(totalSupply).to.be.bignumber.eq(initialBalance);
    // allowance should be remaining amount
    const finalAllowance = await token().allowance.call(fromAddr, broker);
    expect(finalAllowance).to.be.bignumber.eq(initialBalance.sub(amount));
  });

  it("should return correct balances after transferring approval in tranches", async () => {
    await token().approve(broker, initialBalance, { from: fromAddr });
    const tranche1 = initialBalance.mul(0.7182).round();
    const tranche2 = initialBalance.sub(tranche1).mul(0.1189273).round();
    const tranche3 = initialBalance.sub(tranche1.add(tranche2));
    // transfer in tranches
    const tx1 = await token().transferFrom(fromAddr, toAddr, tranche1, {
      from: broker
    });
    expectTransferEvent(tx1, fromAddr, toAddr, tranche1);
    const tx2 = await token().transferFrom(fromAddr, toAddr, tranche2, {
      from: broker
    });
    expectTransferEvent(tx2, fromAddr, toAddr, tranche2);
    const tx3 = await token().transferFrom(fromAddr, toAddr, tranche3, {
      from: broker
    });
    expectTransferEvent(tx3, fromAddr, toAddr, tranche3);
    // we transfered whole amount so:
    const balanceFrom = await token().balanceOf.call(fromAddr);
    expect(balanceFrom).to.be.bignumber.eq(0);
    const balanceThird = await token().balanceOf.call(toAddr);
    expect(balanceThird).to.be.bignumber.eq(initialBalance);
    const balanceTo = await token().balanceOf.call(broker);
    expect(balanceTo).to.be.bignumber.eq(0);
    // total supply should not change
    const totalSupply = await token().totalSupply.call();
    expect(totalSupply).to.be.bignumber.eq(initialBalance);
    // allowance should be 0
    const finalAllowance = await token().allowance.call(fromAddr, broker);
    expect(finalAllowance).to.be.bignumber.eq(0);
  });

  it("should reject transferFrom if 1 'wei' above approval", async () => {
    const amount = initialBalance.mul(0.281972).round();
    await token().approve(broker, amount, { from: fromAddr });
    // transfer more than amount but within balance
    await expect(
      token().transferFrom(fromAddr, toAddr, amount.add(1), {
        from: broker
      })
    ).to.be.rejectedWith(EvmError);
  });

  it("should reject transferFrom if 1 'wei' above balance", async () => {
    const amount = initialBalance.add(1);
    await token().approve(broker, amount, { from: fromAddr });
    // transfer amount that is over balance
    await expect(
      token().transferFrom(fromAddr, toAddr, amount, { from: broker })
    ).to.be.rejectedWith(EvmError);
  });

  it("should throw an error when trying to transferFrom to 0x0", async () => {
    await token().approve(broker, initialBalance, { from: fromAddr });
    await expect(
      token().transferFrom(fromAddr, 0x0, initialBalance, { from: broker })
    ).to.be.rejectedWith(EvmError);
  });
}

export function erc677TokenTests(token, erc677cb, fromAddr, initialBalance) {
  it("should approve and call whole balance", async () => {
    await erc677cb().setCallbackReturnValue(true);
    const tx = await token().approveAndCall(
      erc677cb().address,
      initialBalance,
      "",
      { from: fromAddr }
    );
    expectApproveEvent(tx, fromAddr, erc677cb().address, initialBalance);
    expectTransferEvent(tx, fromAddr, erc677cb().address, initialBalance);
    const finalBalance = await token().balanceOf.call(erc677cb().address);
    expect(finalBalance).to.be.bignumber.eq(initialBalance);
  });

  it("should approve and call whole balance with extraData", async () => {
    await erc677cb().setCallbackReturnValue(true);
    const data = "0x79bc68b14fe3225ab8fe3278b412b93956d49c2d";
    // test token requires this data in callback
    await erc677cb().setAcceptedExtraData(data);
    const tx = await token().approveAndCall(
      erc677cb().address,
      initialBalance,
      data,
      { from: fromAddr }
    );
    expectApproveEvent(tx, fromAddr, erc677cb().address, initialBalance);
    expectTransferEvent(tx, fromAddr, erc677cb().address, initialBalance);
    const finalBalance = await token().balanceOf.call(erc677cb().address);
    expect(finalBalance).to.be.bignumber.eq(initialBalance);
  });

  it("should reject approve and call when test token returns false", async () => {
    await erc677cb().setCallbackReturnValue(false);
    await expect(
      token().approveAndCall(erc677cb().address, initialBalance, "", {
        from: fromAddr
      })
    ).to.be.rejectedWith(EvmError);
  });
}

export function erc223TokenTests(token, fromAddr, toAddr, initialBalance) {
  it("erc20 compatible transfer should not call fallback", async () => {
    const erc223cb = await deployTestErc223Callback();
    const tx = await token().transfer(erc223cb.address, initialBalance, {
      from: fromAddr
    });
    // expect erc20 backward compatible Transfer event
    expectTransferEvent(tx, fromAddr, erc223cb.address, initialBalance);
    const finalBalance = await token().balanceOf.call(erc223cb.address);
    expect(finalBalance).to.be.bignumber.eq(initialBalance);
    // fallback was not called on contract
    const fallbackAmount = await erc223cb.amount.call();
    expect(fallbackAmount).to.be.bignumber.eq(0);
  });

  it(
    "erc223 compatible transfer should call fallback (truffle #569 needs to be fixed)"
  );
  /* it("erc223 compatible transfer should call fallback", async() => {
    const erc223cb = await deployTestErc223Callback();
    const data = "!79bc68b14fe3225ab8fe3278b412b93956d49c2dN";
    const tx = await token().transfer223(erc223cb.address, initialBalance, data, {from: fromAddr} );
    // expect erc20 backward compatible Transfer event
    console.log('check event');
    expectTransferEvent(tx, fromAddr, erc223cb.address, initialBalance);
    const finalBalance = await token().balanceOf.call(erc223cb.address);
    expect(finalBalance).to.be.bignumber.eq(initialBalance);
    // fallback was called on contract
    const fallbackAmount = await erc223cb.amount.call();
    expect(fallbackAmount).to.be.bignumber.eq(initialBalance);
    const fallbackFrom = await erc223cb.from.call();
    expect(fallbackFrom).to.eq(fromAddr);
    const fallbackDataKeccak = await erc223cb.dataKeccak();
    expect(fallbackDataKeccak).to.eq(web3.sha3(data));
  }); */

  it(
    "erc223 compatible transfer should send to simple address (truffle #569 needs to be fixed)"
  );
  /* it("erc223 compatible transfer should send to simple address", async() => {
    const data = "!79bc68b14fe3225ab8fe3278b412b93956d49c2dN";
    const tx = await token().transfer223(toAddr, initialBalance, data, {from: fromAddr} );
    // expect erc20 backward compatible Transfer event
    console.log('check event');
    expectTransferEvent(tx, fromAddr, toAddr, initialBalance);
    const finalBalance = await token().balanceOf.call(toAddr);
    expect(finalBalance).to.be.bignumber.eq(initialBalance);
  }); */
}

export function testWithdrawal(token, investor, initialBalance) {
  it("should withdraw whole balance after deposit", async () => {
    const tx = await token().withdraw(initialBalance, { from: investor });
    expectWithdrawEvent(tx, investor, initialBalance);
    expectTransferEvent(tx, investor, ZERO_ADDRESS, initialBalance);
    const finalBalance = await token().balanceOf.call(investor);
    expect(finalBalance).to.be.bignumber.eq(0);
    const finalSupply = await token().totalSupply.call();
    expect(finalSupply).to.be.bignumber.eq(0);
  });

  it("should withdraw whole balance in tranches", async () => {
    const tranche1 = initialBalance.mul(0.7182).round();
    const tranche2 = initialBalance.sub(tranche1).sub(1);
    const tranche3 = new web3.BigNumber(1);
    const tx1 = await token().withdraw(tranche1, { from: investor });
    expectWithdrawEvent(tx1, investor, tranche1);
    expectTransferEvent(tx1, investor, ZERO_ADDRESS, tranche1);
    const tx2 = await token().withdraw(tranche2, { from: investor });
    expectWithdrawEvent(tx2, investor, tranche2);
    expectTransferEvent(tx2, investor, ZERO_ADDRESS, tranche2);
    const tx3 = await token().withdraw(tranche3, { from: investor });
    expectWithdrawEvent(tx3, investor, tranche3);
    expectTransferEvent(tx3, investor, ZERO_ADDRESS, tranche3);

    const finalBalance = await token().balanceOf.call(investor);
    expect(finalBalance).to.be.bignumber.eq(0);
    const finalSupply = await token().totalSupply.call();
    expect(finalSupply).to.be.bignumber.eq(0);
  });

  it("should reject to withdraw balance + 1 'wei'", async () => {
    await expect(
      token().withdraw(initialBalance.add(1), { from: investor })
    ).to.be.rejectedWith(EvmError);
  });
}

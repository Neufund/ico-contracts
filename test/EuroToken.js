import { expect } from "chai";
import { prettyPrintGasCost } from "./helpers/gasUtils";
import createAccessPolicy from "./helpers/createAccessPolicy";
import {
  basicTokenTests,
  standardTokenTests,
  erc677TokenTests,
  deployTestErc677Callback,
  ZERO_ADDRESS,
  expectTransferEvent,
  testWithdrawal
} from "./helpers/tokenTestCases";
import { eventValue } from "./helpers/events";
import { etherToWei } from "./helpers/unitConverter";
import roles from "./helpers/roles";
import EvmError from "./helpers/EVMThrow";

const EuroToken = artifacts.require("EuroToken");

contract("EuroToken", ([_, depositManager, other, broker, ...investors]) => {
  let rbap;
  let euroToken;

  beforeEach(async () => {
    rbap = await createAccessPolicy([
      { subject: depositManager, role: roles.eurtDepositManager }
    ]);
    euroToken = await EuroToken.new(rbap.address);
  });

  describe("specific tests", () => {
    function expectDepositEvent(tx, owner, amount) {
      const event = eventValue(tx, "LogDeposit");
      expect(event).to.exist;
      expect(event.args.to).to.eq(owner);
      expect(event.args.amount).to.be.bignumber.eq(amount);
    }

    function expectAllowedToEvent(tx, to, allowed) {
      const event = eventValue(tx, "LogAllowedToAddress");
      expect(event).to.exist;
      expect(event.args.to).to.eq(to);
      expect(event.args.allowed).to.eq(allowed);
    }

    function expectAllowedFromEvent(tx, from, allowed) {
      const event = eventValue(tx, "LogAllowedFromAddress");
      expect(event).to.exist;
      expect(event.args.from).to.eq(from);
      expect(event.args.allowed).to.eq(allowed);
    }

    it("should deploy", async () => {
      await prettyPrintGasCost("EuroToken deploy", euroToken);
    });

    it("should deposit", async () => {
      const initialBalance = etherToWei(1.19827398791827);
      const tx = await euroToken.deposit(investors[0], initialBalance, {
        from: depositManager
      });
      expectDepositEvent(tx, investors[0], initialBalance);
      expectTransferEvent(tx, ZERO_ADDRESS, investors[0], initialBalance);
      const totalSupply = await euroToken.totalSupply.call();
      expect(totalSupply).to.be.bignumber.eq(initialBalance);
      const balance = await euroToken.balanceOf(investors[0]);
      expect(balance).to.be.bignumber.eq(initialBalance);
    });

    it("should overflow totalSupply on deposit", async () => {
      const initialBalance = new web3.BigNumber(2).pow(256).sub(1);
      await euroToken.deposit(investors[0], initialBalance, {
        from: depositManager
      });
      await expect(
        euroToken.deposit(investors[1], initialBalance, {
          from: depositManager
        })
      ).to.be.rejectedWith(EvmError);
    });

    it("should allow transfer to investor after deposit", async () => {
      const initialBalance = etherToWei(83781221);
      const tx = await euroToken.deposit(investors[0], initialBalance, {
        from: depositManager
      });
      expectAllowedToEvent(tx, investors[0], true);
      const isAllowed = await euroToken.allowedTransferTo.call(investors[0]);
      expect(isAllowed).to.be.true;
    });

    it("should reject deposit not from deposit manager", async () => {
      const initialBalance = etherToWei(820938);
      await expect(
        euroToken.deposit(investors[0], initialBalance, { from: other })
      ).to.be.rejectedWith(EvmError);
    });

    it("should reject deposit to address 0", async () => {
      const initialBalance = etherToWei(19821);
      await expect(
        euroToken.deposit(ZERO_ADDRESS, initialBalance, {
          from: depositManager
        })
      ).to.be.rejectedWith(EvmError);
    });

    it("should transfer between investors via broker with minimum permissions", async () => {
      const initialBalance = etherToWei(83781221);
      await euroToken.deposit(investors[0], initialBalance, {
        from: depositManager
      });
      await euroToken.deposit(investors[1], initialBalance, {
        from: depositManager
      });
      await euroToken.approve(broker, initialBalance, { from: investors[0] });
      // no special permissions for investors needed, just the broker
      await euroToken.setAllowedTransferFrom(broker, true, {
        from: depositManager
      });
      await euroToken.setAllowedTransferTo(broker, true, {
        from: depositManager
      });

      await euroToken.transferFrom(investors[0], investors[1], initialBalance, {
        from: broker
      });
      const afterBalance = await euroToken.balanceOf.call(investors[1]);
      expect(afterBalance).to.be.bignumber.eq(initialBalance.mul(2));
    });

    it("should transfer between allowed investors", async () => {
      const initialBalance = etherToWei(183781221);
      await euroToken.deposit(investors[0], initialBalance, {
        from: depositManager
      });
      const tx1 = await euroToken.setAllowedTransferTo(investors[1], true, {
        from: depositManager
      });
      expectAllowedToEvent(tx1, investors[1], true);
      const tx2 = await euroToken.setAllowedTransferFrom(investors[0], true, {
        from: depositManager
      });
      expectAllowedFromEvent(tx2, investors[0], true);
      // drop uneccessary 'to' permission for first investor
      const tx3 = await euroToken.setAllowedTransferTo(investors[0], false, {
        from: depositManager
      });
      expectAllowedToEvent(tx3, investors[0], false);
      await euroToken.transfer(investors[1], initialBalance, {
        from: investors[0]
      });
      const afterBalance = await euroToken.balanceOf.call(investors[1]);
      expect(afterBalance).to.be.bignumber.eq(initialBalance);
    });

    it("should not transfer from not allowed", async () => {
      await expect(
        euroToken.transfer(investors[1], 0, { from: investors[0] })
      ).to.be.rejectedWith(EvmError);
    });

    it("should be able to reclaim euro token");
  });

  describe("IBasicToken tests", () => {
    const initialBalance = etherToWei(1.19827398791827);
    const getToken = () => euroToken;

    beforeEach(async () => {
      await euroToken.deposit(investors[1], initialBalance, {
        from: depositManager
      });
      await euroToken.setAllowedTransferFrom(investors[1], true, {
        from: depositManager
      });
      await euroToken.setAllowedTransferTo(investors[2], true, {
        from: depositManager
      });
      await euroToken.setAllowedTransferTo(0x0, true, { from: depositManager });
    });

    basicTokenTests(getToken, investors[1], investors[2], initialBalance);
  });

  describe("IERC20Allowance tests", () => {
    const initialBalance = etherToWei(1.19827398791827);
    const getToken = () => euroToken;

    beforeEach(async () => {
      await euroToken.deposit(investors[1], initialBalance, {
        from: depositManager
      });
      // receiving investor to receive
      await euroToken.setAllowedTransferTo(investors[2], true, {
        from: depositManager
      });
      // broker permission to send
      await euroToken.setAllowedTransferFrom(broker, true, {
        from: depositManager
      });
      await euroToken.setAllowedTransferTo(0x0, true, { from: depositManager });
    });

    standardTokenTests(
      getToken,
      investors[1],
      investors[2],
      broker,
      initialBalance
    );
  });

  describe("IERC677Token tests", () => {
    const initialBalance = etherToWei(1.19827398791827);
    const getToken = () => euroToken;
    let erc667cb;
    const getTestErc667cb = () => erc667cb;

    beforeEach(async () => {
      erc667cb = await deployTestErc677Callback();
      await euroToken.deposit(investors[1], initialBalance, {
        from: depositManager
      });
      // broker (which is receiver) permission to send
      await euroToken.setAllowedTransferFrom(erc667cb.address, true, {
        from: depositManager
      });
      // receiver permission to receive
      await euroToken.setAllowedTransferTo(erc667cb.address, true, {
        from: depositManager
      });
    });

    erc677TokenTests(getToken, getTestErc667cb, investors[1], initialBalance);
  });

  describe("withdrawal tests", () => {
    const initialBalance = etherToWei(1.19827398791827);
    const getToken = () => euroToken;

    beforeEach(async () => {
      await euroToken.deposit(investors[0], initialBalance, {
        from: depositManager
      });
    });

    testWithdrawal(getToken, investors[0], initialBalance);
  });
});

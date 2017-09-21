import { expect } from "chai";
import { prettyPrintGasCost } from "./helpers/gasUtils";
import createAccessPolicy from "./helpers/createAccessPolicy";
import { saveBlockchain, restoreBlockchain } from "./helpers/evmCommands";
import {
  basicTokenTests,
  standardTokenTests,
  erc677TokenTests,
  deployTestErc677Callback,
  erc223TokenTests,
  expectTransferEvent,
  ZERO_ADDRESS,
  testWithdrawal
} from "./helpers/tokenTestCases";
import { eventValue } from "./helpers/events";
import { etherToWei } from "./helpers/unitConverter";

const EtherToken = artifacts.require("EtherToken");

contract("EtherToken", ([broker, ...investors]) => {
  let snapshot;
  let etherToken;

  before(async () => {
    const rbac = await createAccessPolicy([]);
    etherToken = await EtherToken.new(rbac.address);
    snapshot = await saveBlockchain();
  });

  beforeEach(async () => {
    await restoreBlockchain(snapshot);
    snapshot = await saveBlockchain();
  });

  describe("specific tests", () => {
    function expectDepositEvent(tx, owner, amount) {
      const event = eventValue(tx, "LogDeposit");
      expect(event).to.exist;
      expect(event.args.to).to.eq(owner);
      expect(event.args.amount).to.be.bignumber.eq(amount);
    }

    it("should deploy", async () => {
      await prettyPrintGasCost("EtherToken deploy", etherToken);
    });

    it("should deposit", async () => {
      const initialBalance = etherToWei(1.19827398791827);
      const tx = await etherToken.deposit({
        from: investors[0],
        value: initialBalance
      });
      expectDepositEvent(tx, investors[0], initialBalance);
      expectTransferEvent(tx, ZERO_ADDRESS, investors[0], initialBalance);
      const totalSupply = await etherToken.totalSupply.call();
      expect(totalSupply).to.be.bignumber.eq(initialBalance);
      const balance = await etherToken.balanceOf(investors[0]);
      expect(balance).to.be.bignumber.eq(initialBalance);
    });

    it("should reject to reclaim ether");
  });

  describe("IBasicToken tests", () => {
    const initialBalance = etherToWei(1.19827398791827);
    const getToken = () => etherToken;

    beforeEach(async () => {
      await etherToken.deposit({
        from: investors[1],
        value: initialBalance
      });
    });

    basicTokenTests(getToken, investors[1], investors[2], initialBalance);
  });

  describe("IERC20Allowance tests", () => {
    const initialBalance = etherToWei(1.0192);
    const getToken = () => etherToken;

    beforeEach(async () => {
      await etherToken.deposit({
        from: investors[1],
        value: initialBalance
      });
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
    const initialBalance = etherToWei(8.91192);
    const getToken = () => etherToken;
    let erc667cb;
    const getTestErc667cb = () => erc667cb;

    beforeEach(async () => {
      await etherToken.deposit({
        from: investors[1],
        value: initialBalance
      });
      erc667cb = await deployTestErc677Callback();
    });

    erc677TokenTests(getToken, getTestErc667cb, investors[1], initialBalance);
  });

  describe("IERC223Token tests", () => {
    const initialBalance = etherToWei(3.98172);
    const getToken = () => etherToken;

    beforeEach(async () => {
      await etherToken.deposit({
        from: investors[1],
        value: initialBalance
      });
    });

    erc223TokenTests(getToken, investors[1], investors[2], initialBalance);
  });

  describe("withdrawal tests", () => {
    const initialBalance = etherToWei(7.189192);
    const getToken = () => etherToken;

    beforeEach(async () => {
      await etherToken.deposit({
        from: investors[1],
        value: initialBalance
      });
    });

    testWithdrawal(getToken, investors[1], initialBalance);
  });
});

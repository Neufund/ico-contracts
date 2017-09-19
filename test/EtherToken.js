import { expect } from "chai";
import { prettyPrintGasCost } from "./helpers/gasUtils";
import createAccessPolicy from "./helpers/createAccessPolicy";
import { saveBlockchain, restoreBlockchain } from "./helpers/evmCommands";
import {
  basicTokenTests,
  standardTokenTests,
  erc677TokenTests,
  deployTestErc677Callback,
  erc223TokenTests
} from "./helpers/tokenTestCases";
import { eventValue } from "./helpers/events";
import ether from "./helpers/ether";

const EtherToken = artifacts.require("EtherToken");

contract("EtherToken", ([...accounts]) => {
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
      await prettyPrintGasCost("EuroToken deploy", etherToken);
    });

    it("should deposit", async () => {
      const initialBalance = ether(1.19827398791827);
      const tx = await etherToken.deposit({
        from: accounts[0],
        value: initialBalance
      });
      expectDepositEvent(tx, accounts[0], initialBalance);
      const totalSupply = await etherToken.totalSupply.call();
      expect(totalSupply).to.be.bignumber.eq(initialBalance);
      const balance = await etherToken.balanceOf(accounts[0]);
      expect(balance).to.be.bignumber.eq(initialBalance);
    });

    it("should reject to reclaim ether");
  });

  describe("IBasicToken tests", () => {
    const initialBalance = ether(1.19827398791827);
    const getToken = () => etherToken;

    beforeEach(async () => {
      await etherToken.deposit({
        from: accounts[1],
        value: initialBalance
      });
    });

    basicTokenTests(getToken, accounts[1], accounts[2], initialBalance);
  });

  describe("IERC20Allowance tests", () => {
    const initialBalance = ether(1.0192);
    const getToken = () => etherToken;

    beforeEach(async () => {
      await etherToken.deposit({
        from: accounts[1],
        value: initialBalance
      });
    });

    standardTokenTests(
      getToken,
      accounts[1],
      accounts[2],
      accounts[3],
      initialBalance
    );
  });

  describe("IERC677Token tests", () => {
    const initialBalance = ether(8.91192);
    const getToken = () => etherToken;
    let erc667cb;
    const getTestErc667cb = () => erc667cb;

    beforeEach(async () => {
      await etherToken.deposit({
        from: accounts[1],
        value: initialBalance
      });
      erc667cb = await deployTestErc677Callback();
    });

    erc677TokenTests(getToken, getTestErc667cb, accounts[1], initialBalance);
  });

  describe("IERC223Token tests", () => {
    const initialBalance = ether(3.98172);
    const getToken = () => etherToken;

    beforeEach(async () => {
      await etherToken.deposit({
        from: accounts[1],
        value: initialBalance
      });
    });

    erc223TokenTests(getToken, accounts[1], accounts[2], initialBalance);
  });
});

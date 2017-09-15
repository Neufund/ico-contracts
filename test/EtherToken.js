import { expect } from "chai";
import { prettyPrintGasCost } from "./helpers/gasUtils";
import createAccessPolicy from "./helpers/createAccessPolicy";
import { saveBlockchain, restoreBlockchain } from "./helpers/evmCommands";
import { basicTokenTests } from "./helpers/tokenTestCases";
import ether from "./helpers/ether";
import roles from "./helpers/roles";

const EtherToken = artifacts.require("EtherToken");

contract("EtherToken", ([deployer, ...accounts]) => {
  let snapshot;
  let etherToken;

  before(async () => {
    const rbac = await createAccessPolicy([]);
    etherToken = await EtherToken.new(rbac);
    snapshot = await saveBlockchain();
  });

  beforeEach(async () => {
    await restoreBlockchain(snapshot);
    snapshot = await saveBlockchain();
  });

  it("should deploy", async () => {
    await prettyPrintGasCost("EuroToken deploy", etherToken);
  });

  it("should deposit", async () => {
    const initialBalance = ether(1.19827398791827);
    const tx = await etherToken.deposit(accounts[0], initialBalance, { from: deployer, value: initialBalance });
    // expectDepositEvent(tx, accounts[0], initialBalance)
    const totalSupply = await etherToken.totalSupply.call();
    expect(totalSupply).to.be.bignumber.eq(initialBalance);
    const balance = await etherToken.balanceOf(accounts[0]);
    expect(balance).to.be.bignumber.eq(initialBalance);
  });

  it("should not be able to reclaim ether");

  // test deposit
  // test deposit max value
  // test deposit overflow


  describe("IBasicToken tests", () => {

    const initialBalance = ether(1.19827398791827);
    const getToken = function () { return etherToken; };

    beforeEach( async () => {
      await etherToken.deposit(accounts[1], initialBalance, { from: deployer, value: initialBalance });
    });

    basicTokenTests(getToken, accounts[1], accounts[2], initialBalance);
  });
});

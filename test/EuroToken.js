import { expect } from "chai";
import { prettyPrintGasCost } from "./helpers/gasUtils";
import createAccessPolicy from "./helpers/createAccessPolicy";
import { saveBlockchain, restoreBlockchain } from "./helpers/evmCommands";
import { basicTokenTests } from "./helpers/tokenTestCases";
import ether from "./helpers/ether";
import roles from "./helpers/roles";

const EuroToken = artifacts.require("./EuroToken.sol");

contract("EuroToken", ([deployer, depositManager, ...accounts]) => {
  let snapshot;
  let rbac;
  let euroToken;

  before(async () => {
    rbac = await createAccessPolicy([
      { subject: depositManager, role: roles.eurtDepositManager }
    ]);
    euroToken = await EuroToken.new(rbac);
    snapshot = await saveBlockchain();
  });

  beforeEach(async () => {
    await restoreBlockchain(snapshot);
    snapshot = await saveBlockchain();
  });

  it("should deploy", async () => {
    await prettyPrintGasCost("EuroToken deploy", euroToken);
  });

  it("should deposit", async () => {
    const initialBalance = ether(1.19827398791827);
    const tx = await euroToken.deposit(accounts[0], initialBalance, { from: depositManager });
    // expectDepositEvent(tx, accounts[0], initialBalance)
    const totalSupply = await euroToken.totalSupply.call();
    expect(totalSupply).to.be.bignumber.eq(initialBalance);
    const balance = await euroToken.balanceOf(accounts[0]);
    expect(balance).to.be.bignumber.eq(initialBalance);
  });

  it("deposit should allow transfer to");

  describe("IBasicToken tests", () => {

    const initialBalance = ether(1.19827398791827);
    const getToken = function () { return euroToken; };

    beforeEach( async () => {
      await euroToken.deposit(accounts[1], initialBalance, { from: depositManager });
      await euroToken.setAllowedTransferFrom(accounts[1], true, { from: depositManager });
      await euroToken.setAllowedTransferTo(accounts[2], true, { from: depositManager });
      await euroToken.setAllowedTransferTo(0x0, true, { from: depositManager });
    });

    basicTokenTests(getToken, accounts[1], accounts[2], initialBalance);
  });
});

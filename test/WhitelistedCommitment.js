import { expect } from "chai";
import EvmError from "./helpers/EVMThrow";
import {
  closeFutureDate,
  furtherFutureDate,
  HOUR,
  MONTH
} from "./helpers/latestTime";
import { setTimeTo } from "./helpers/increaseTime";
import { etherToWei, shanToWei } from "./helpers/unitConverter";
import deployAllContracts from "./helpers/deploy";
import {
  curveInEther,
  deployMutableCurve,
  ethToEur
} from "./helpers/verification";

contract(
  "WhitelistedCommitment",
  ([_, lockAdminAccount, whitelistAdminAccount, ...accounts]) => {
    describe("set fixed investors", () => {
      it("should work", async () => {
        const investors = [accounts[0], accounts[1]];
        const tickets = [etherToWei(1), etherToWei(2)];
        const expectedTicketsSum = tickets[0].add(tickets[1]);
        const expectedNeumarkAmmount = await curveInEther(expectedTicketsSum);

        const { commitment, curve } = await deployAllContracts(
          lockAdminAccount,
          whitelistAdminAccount
        );
        await commitment.setFixed(investors, tickets, {
          from: whitelistAdminAccount
        });

        expect(await commitment.fixedCostInvestors(0)).to.be.eq(investors[0]);
        expect(await commitment.fixedCostInvestors(1)).to.be.eq(investors[1]);
        await expect(commitment.fixedCostInvestors).to.blockchainArrayOfSize(2);

        expect(await commitment.fixedCost(investors[0])).to.be.bignumber.eq(
          tickets[0]
        );
        expect(await commitment.fixedCost(investors[1])).to.be.bignumber.eq(
          tickets[1]
        );

        expect(await commitment.whitelisted(investors[0])).to.be.bignumber.eq(
          1
        );
        expect(await commitment.whitelisted(investors[1])).to.be.bignumber.eq(
          1
        );

        expect(await commitment.totalFixedCostAmount()).to.be.bignumber.eq(
          expectedTicketsSum
        );
        expect(await commitment.totalFixedCostNeumarks()).to.be.bignumber.eq(
          expectedNeumarkAmmount
        );
      });

      it("should not be possible to set it twice", async () => {
        const { commitment, curve } = await deployAllContracts(
          lockAdminAccount,
          whitelistAdminAccount
        );
        const investors = [accounts[0], accounts[1]];
        const tickets = [etherToWei(1), etherToWei(2)];

        await commitment.setFixed(investors, tickets, {
          from: whitelistAdminAccount
        });

        await expect(
          commitment.setFixed(investors, tickets, {
            from: whitelistAdminAccount
          })
        ).to.be.rejectedWith(EvmError);
      });

      it("should not be possible to set it after commitment is started", async () => {
        const startingDate = closeFutureDate();
        const {
          commitment,
          curve
        } = await deployAllContracts(lockAdminAccount, whitelistAdminAccount, {
          commitmentCfg: { startTimestamp: startingDate }
        });
        const investors = [accounts[0], accounts[1]];
        const tickets = [etherToWei(1), etherToWei(2)];

        await setTimeTo(startingDate);

        await expect(
          commitment.setFixed(investors, tickets, {
            from: whitelistAdminAccount
          })
        ).to.be.rejectedWith(EvmError);
      });

      it("should not be possible to set it with not matching input", async () => {
        const { commitment, curve } = await deployAllContracts(
          lockAdminAccount,
          whitelistAdminAccount
        );
        const investors = [accounts[0]];
        const tickets = [etherToWei(1), etherToWei(2)];

        await expect(
          commitment.setFixed(investors, tickets, {
            from: whitelistAdminAccount
          })
        ).to.be.rejectedWith(EvmError);
      });
    });

    describe("set whitelisted investors", () => {
      it("should work", async () => {
        const { commitment } = await deployAllContracts(
          lockAdminAccount,
          whitelistAdminAccount
        );
        const investors = [accounts[0], accounts[1]];

        await commitment.setWhitelist(investors, {
          from: whitelistAdminAccount
        });

        expect(await commitment.whitelistedInvestors(0)).to.be.eq(investors[0]);
        expect(await commitment.whitelistedInvestors(1)).to.be.eq(investors[1]);
        await expect(commitment.whitelistedInvestors).to.blockchainArrayOfSize(
          2
        );

        expect(await commitment.whitelisted(investors[0])).to.be.bignumber.eq(
          1
        );
        expect(await commitment.whitelisted(investors[1])).to.be.bignumber.eq(
          1
        );

        expect(await commitment.totalFixedCostAmount()).to.be.bignumber.eq(0);
        expect(await commitment.totalFixedCostNeumarks()).to.be.bignumber.eq(0);
      });

      it("should not be possible to set it twice", async () => {
        const { commitment } = await deployAllContracts(
          lockAdminAccount,
          whitelistAdminAccount
        );
        const investors = [accounts[0], accounts[1]];

        await commitment.setWhitelist(investors, {
          from: whitelistAdminAccount
        });

        await expect(
          commitment.setWhitelist(investors, { from: whitelistAdminAccount })
        ).to.be.rejectedWith(EvmError);
      });

      it("should not be possible to set it after commitment is started", async () => {
        const startingDate = closeFutureDate();
        const {
          commitment,
          curve
        } = await deployAllContracts(lockAdminAccount, whitelistAdminAccount, {
          commitmentCfg: { startTimestamp: startingDate }
        });
        const investors = [accounts[0], accounts[1]];

        await setTimeTo(startingDate);

        await expect(
          commitment.setWhitelist(investors, { from: whitelistAdminAccount })
        ).to.be.rejectedWith(EvmError);
      });
    });

    describe("set whitelist investor with fixed investors", () => {
      it("should be possible to whitelist investors before fixed investors", async () => {
        const { commitment } = await deployAllContracts(
          lockAdminAccount,
          whitelistAdminAccount
        );
        const whitelistedInvestors = [accounts[0], accounts[1]];
        const fixedInvestors = [accounts[2]];
        const fixedTickets = [etherToWei(1)];

        await commitment.setWhitelist(whitelistedInvestors, {
          from: whitelistAdminAccount
        });
        await commitment.setFixed(fixedInvestors, fixedTickets, {
          from: whitelistAdminAccount
        });

        expect(await commitment.whitelistedInvestors(0)).to.be.eq(
          whitelistedInvestors[0]
        );
        expect(await commitment.whitelistedInvestors(1)).to.be.eq(
          whitelistedInvestors[1]
        );
        await expect(commitment.whitelistedInvestors).to.blockchainArrayOfSize(
          2
        );

        expect(
          await commitment.whitelisted(whitelistedInvestors[0])
        ).to.be.bignumber.eq(1);
        expect(
          await commitment.whitelisted(whitelistedInvestors[1])
        ).to.be.bignumber.eq(1);
        expect(
          await commitment.whitelisted(fixedInvestors[0])
        ).to.be.bignumber.eq(1);

        expect(await commitment.fixedCostInvestors(0)).to.be.eq(
          fixedInvestors[0]
        );
        await expect(commitment.fixedCostInvestors).to.blockchainArrayOfSize(1);

        expect(
          await commitment.fixedCost(fixedInvestors[0])
        ).to.be.bignumber.eq(fixedTickets[0]);
        expect(
          await commitment.fixedCost(whitelistedInvestors[0])
        ).to.be.bignumber.eq(0);
        expect(
          await commitment.fixedCost(whitelistedInvestors[1])
        ).to.be.bignumber.eq(0);
      });

      it("should be possible to whitelist investors after fixed investors", async () => {
        const { commitment } = await deployAllContracts(
          lockAdminAccount,
          whitelistAdminAccount
        );
        const whitelistedInvestors = [accounts[0], accounts[1]];
        const fixedInvestors = [accounts[2]];
        const fixedTickets = [etherToWei(1)];

        await commitment.setFixed(fixedInvestors, fixedTickets, {
          from: whitelistAdminAccount
        });
        await commitment.setWhitelist(whitelistedInvestors, {
          from: whitelistAdminAccount
        });

        expect(await commitment.whitelistedInvestors(0)).to.be.eq(
          whitelistedInvestors[0]
        );
        expect(await commitment.whitelistedInvestors(1)).to.be.eq(
          whitelistedInvestors[1]
        );
        await expect(commitment.whitelistedInvestors).to.blockchainArrayOfSize(
          2
        );

        expect(
          await commitment.whitelisted(whitelistedInvestors[0])
        ).to.be.bignumber.eq(1);
        expect(
          await commitment.whitelisted(whitelistedInvestors[1])
        ).to.be.bignumber.eq(1);
        expect(
          await commitment.whitelisted(fixedInvestors[0])
        ).to.be.bignumber.eq(1);

        expect(await commitment.fixedCostInvestors(0)).to.be.eq(
          fixedInvestors[0]
        );
        await expect(commitment.fixedCostInvestors).to.blockchainArrayOfSize(1);

        expect(
          await commitment.fixedCost(fixedInvestors[0])
        ).to.be.bignumber.eq(fixedTickets[0]);
        expect(
          await commitment.fixedCost(whitelistedInvestors[0])
        ).to.be.bignumber.eq(0);
        expect(
          await commitment.fixedCost(whitelistedInvestors[1])
        ).to.be.bignumber.eq(0);
      });
    });

    describe("fixed size commitment", () => {
      it("should work with ticket below declared", async () => {
        const startingDate = closeFutureDate();
        const investor1 = accounts[0];
        const fixedInvestors = [investor1, accounts[1]];
        const fixedDeclaredTickets = [etherToWei(2), etherToWei(3)];
        const actualInvestor1Commitment = etherToWei(1);
        const expectedTicketsSum = fixedDeclaredTickets[0].add(
          fixedDeclaredTickets[1]
        );
        const expectedNeumarkAmmount = await curveInEther(expectedTicketsSum);
        const expectedInvestor1NeumarkShare = expectedNeumarkAmmount
          .mul(actualInvestor1Commitment)
          .div(expectedTicketsSum)
          .div(2)
          .round(0, 4);

        const {
          commitment,
          lockedAccount
        } = await deployAllContracts(lockAdminAccount, whitelistAdminAccount, {
          commitmentCfg: {
            fixedInvestors,
            fixedTickets: fixedDeclaredTickets,
            startTimestamp: startingDate
          }
        });
        await setTimeTo(startingDate);
        await commitment.commit({
          value: actualInvestor1Commitment,
          from: investor1
        });

        expect(await lockedAccount.balanceOf(investor1)).to.be.balanceWith({
          ether: actualInvestor1Commitment,
          neumarks: expectedInvestor1NeumarkShare
        });
      });

      it("should send all funds in case of rounding errors", async () => {
        const startingDate = closeFutureDate();
        const investor1 = accounts[0];
        const fixedInvestors = [investor1];
        const fixedDeclaredTickets = [etherToWei(2)];
        const actualInvestor1Commitment1 = etherToWei(1.9);
        const actualInvestor1Commitment2 = etherToWei(0.1);

        const expectedTicketsSum = fixedDeclaredTickets[0];
        const expectedNeumarkAmmount = await curveInEther(expectedTicketsSum);
        const expectedInvestor1NeumarkShare = expectedNeumarkAmmount
          .div(2)
          .round(0, 4)
          .add(1); // for rounding error

        const {
          commitment,
          lockedAccount,
          neumark
        } = await deployAllContracts(lockAdminAccount, whitelistAdminAccount, {
          commitmentCfg: {
            fixedInvestors,
            fixedTickets: fixedDeclaredTickets,
            startTimestamp: startingDate,
            minTicket: etherToWei(0.01)
          }
        });
        await setTimeTo(startingDate);
        await commitment.commit({
          value: actualInvestor1Commitment1,
          from: investor1
        });
        await commitment.commit({
          value: actualInvestor1Commitment2,
          from: investor1
        });

        expect(await lockedAccount.balanceOf(investor1)).to.be.balanceWith({
          ether: actualInvestor1Commitment1.add(actualInvestor1Commitment2),
          neumarks: expectedInvestor1NeumarkShare
        });
        expect(await neumark.balanceOf(commitment.address)).to.be.bignumber.eq(
          new web3.BigNumber(0)
        );
      });

      it("should work with ticket exactly the same as declared", async () => {
        const startingDate = closeFutureDate();
        const investor1 = accounts[0];
        const fixedInvestors = [investor1, accounts[1]];
        const fixedDeclaredTickets = [etherToWei(1.21981798), etherToWei(3)];
        const actualInvestor1Commitment = etherToWei(1.21981798);
        const expectedTicketsSum = fixedDeclaredTickets[0].add(
          fixedDeclaredTickets[1]
        );
        const expectedNeumarkAmmount = await curveInEther(expectedTicketsSum);
        const expectedInvestor1NeumarkShare = expectedNeumarkAmmount
          .mul(actualInvestor1Commitment)
          .div(expectedTicketsSum)
          .div(2)
          .round(0, 4);

        const {
          commitment,
          lockedAccount
        } = await deployAllContracts(lockAdminAccount, whitelistAdminAccount, {
          commitmentCfg: {
            fixedInvestors,
            fixedTickets: fixedDeclaredTickets,
            startTimestamp: startingDate
          }
        });
        await setTimeTo(startingDate);
        await commitment.commit({
          value: actualInvestor1Commitment,
          from: investor1
        });

        expect(await lockedAccount.balanceOf(investor1)).to.be.balanceWith({
          ether: actualInvestor1Commitment,
          neumarks: expectedInvestor1NeumarkShare
        });
      });

      it("should work with ticket much bigger then declared", async () => {
        await investorTicketBiggerThenDeclared(
          accounts.slice(0, 2),
          [etherToWei(1), etherToWei(3)],
          etherToWei(1.2345)
        );
      });

      it("should work with ticket a little bit bigger then declared", async () => {
        await investorTicketBiggerThenDeclared(
          accounts.slice(0, 1),
          [etherToWei(1)],
          etherToWei(1).add(1)
        );
      });

      it("should allow fixed investor to make commitment in mulitple tickets");
      it("should not allow whitelisted investor to take part in fixed ");
      it("should not work when investor is not on the list");
      it("should not be possible to invest before ico");
    });

    describe("whitelisted commitment", () => {
      it("should work for whitelisted investors", async () => {
        const verificationCurve = await deployMutableCurve();
        const startingDate = closeFutureDate();
        const whitelistedInvestors = [accounts[0], accounts[1]];
        const ticketSizes = [etherToWei(1.5), etherToWei(5)];

        const expectedNeumarksAmmount = [
          (await verificationCurve.issueInEth(ticketSizes[0]))
            .div(2)
            .round(0, 4),
          (await verificationCurve.issueInEth(ticketSizes[1]))
            .div(2)
            .round(0, 4)
        ];

        const {
          commitment,
          lockedAccount
        } = await deployAllContracts(lockAdminAccount, whitelistAdminAccount, {
          commitmentCfg: {
            whitelistedInvestors,
            startTimestamp: startingDate
          }
        });
        await setTimeTo(startingDate);
        await commitment.commit({
          value: ticketSizes[0],
          from: whitelistedInvestors[0]
        });
        await commitment.commit({
          value: ticketSizes[1],
          from: whitelistedInvestors[1]
        });

        expect(
          await lockedAccount.balanceOf(whitelistedInvestors[0])
        ).to.be.balanceWith({
          ether: ticketSizes[0],
          neumarks: expectedNeumarksAmmount[0]
        });
        expect(
          await lockedAccount.balanceOf(whitelistedInvestors[1])
        ).to.be.balanceWith({
          ether: ticketSizes[1],
          neumarks: expectedNeumarksAmmount[1]
        });
      });

      it("should not work with not whitelisted investors", async () => {
        const startingDate = closeFutureDate();
        const whitelistedInvestors = [accounts[0], accounts[1]];
        const investor = accounts[2];
        const ticketSize = etherToWei(1.5);

        const {
          commitment,
          lockedAccount
        } = await deployAllContracts(lockAdminAccount, whitelistAdminAccount, {
          commitmentCfg: {
            whitelistedInvestors,
            startTimestamp: startingDate
          }
        });
        await setTimeTo(startingDate);

        expect(
          commitment.commit({ value: ticketSize, from: investor })
        ).to.be.rejectedWith(EvmError);
      });

      it("should not be possible to invest before ICO", async () => {
        const startingDate = closeFutureDate();
        const whitelistedInvestors = [accounts[0], accounts[1]];
        const investor = accounts[2];
        const ticketSize = etherToWei(1.5);

        const {
          commitment,
          lockedAccount
        } = await deployAllContracts(lockAdminAccount, whitelistAdminAccount, {
          commitmentCfg: {
            whitelistedInvestors,
            startTimestamp: startingDate
          }
        });

        expect(
          commitment.commit({ value: ticketSize, from: investor })
        ).to.be.rejectedWith(EvmError);
      });

      it("should not be possible to invest after ICO", async () => {
        const startingDate = closeFutureDate();
        const duration = MONTH;
        const whitelistedInvestors = [accounts[0], accounts[1]];
        const investor = accounts[2];
        const ticketSize = etherToWei(1.5);

        const {
          commitment,
          lockedAccount
        } = await deployAllContracts(lockAdminAccount, whitelistAdminAccount, {
          commitmentCfg: {
            whitelistedInvestors,
            duration,
            startTimestamp: startingDate,
            startTimestamp: startingDate
          }
        });
        await setTimeTo(startingDate + duration + HOUR);

        expect(
          commitment.commit({ value: ticketSize, from: investor })
        ).to.be.rejectedWith(EvmError);
      });
    });

    describe("failed comittment", () => {
      it("should unlock all accounts", async () => {
        const startingDate = closeFutureDate();
        const duration = MONTH;
        const whitelistedInvestors = [accounts[4], accounts[5]];
        const investor = whitelistedInvestors[0];
        const ticketSize = etherToWei(1.5);
        const initialAccountBalance = await web3.eth.getBalance(investor);
        const gasPrice = 1;
        let accGas;

        const {
          commitment,
          lockedAccount,
          etherToken
        } = await deployAllContracts(lockAdminAccount, whitelistAdminAccount, {
          commitmentCfg: {
            whitelistedInvestors,
            duration,
            startTimestamp: startingDate,
            startTimestamp: startingDate
          }
        });
        await setTimeTo(startingDate + HOUR);
        accGas = accumulateGasPrice(
          await commitment.commit({
            value: ticketSize,
            from: investor,
            gasPrice
          }),
          accGas
        );
        await setTimeTo(startingDate + MONTH + HOUR);

        accGas = accumulateGasPrice(
          await commitment.finalize({ from: investor, gasPrice }),
          accGas
        );
        accGas = accumulateGasPrice(
          await lockedAccount.unlock({ from: investor, gasPrice }),
          accGas
        );
        accGas = accumulateGasPrice(
          await etherToken.withdraw(ticketSize, { from: investor, gasPrice }),
          accGas
        );

        const gasCost = accGas.mul(gasPrice);
        const finalAccountBalance = await web3.eth.getBalance(investor);

        expect(finalAccountBalance).to.be.bignumber.eq(
          initialAccountBalance.sub(gasCost)
        );
      });
    });

    describe("successful comittment", () => {
      it("should burn unused neumarks from fixed pool", async () => {
        const startingDate = closeFutureDate();
        const duration = MONTH;
        const mutableCurve = await deployMutableCurve();
        const investor1 = accounts[0];
        const fixedInvestors = [investor1, accounts[1]];
        const fixedDeclaredTickets = [etherToWei(1), etherToWei(3)];
        const equalShareSize = fixedDeclaredTickets[0];
        const expectedTicketsSum = fixedDeclaredTickets[0].add(
          fixedDeclaredTickets[1]
        );
        const expectedNeumarkAmmountOnFixedRate = await mutableCurve.issueInEth(
          expectedTicketsSum
        );
        const expectedError = new web3.BigNumber(309243939690474); // this is much, much less then 1 cent

        const {
          commitment,
          lockedAccount,
          curve
        } = await deployAllContracts(lockAdminAccount, whitelistAdminAccount, {
          commitmentCfg: {
            fixedInvestors,
            fixedTickets: fixedDeclaredTickets,
            startTimestamp: startingDate,
            minCommitment: etherToWei(0.5),
            duration
          }
        });
        expect(await curve.totalEuroUlps()).to.be.bignumber.eq(
          ethToEur(expectedTicketsSum)
        ); // should secure all neumarks on fixed pool

        await setTimeTo(startingDate);
        await commitment.commit({
          value: fixedDeclaredTickets[0],
          from: investor1
        });

        await setTimeTo(startingDate + duration + HOUR);
        await commitment.finalize();

        const difference = ethToEur(fixedDeclaredTickets[0]).sub(
          await curve.totalEuroUlps()
        );
        expect(difference).to.be.bignumber.eq(expectedError); // should burn unsed fixed pool neumarks
      });
    });

    async function investorTicketBiggerThenDeclared(
      investorAccounts,
      investorDeclaration,
      firstInvestorTicket
    ) {
      const startingDate = closeFutureDate();
      const mutableCurve = await deployMutableCurve();
      const equalShareSize = investorDeclaration[0];
      const curveShareSize = firstInvestorTicket.sub(equalShareSize);
      const expectedTicketsSum = investorDeclaration.reduce(
        (a, x) => a.add(x),
        new web3.BigNumber(0)
      );
      const expectedNeumarkAmmountOnFixedRate = await mutableCurve.issueInEth(
        expectedTicketsSum
      );
      const expectedNeumarkAmmountOnTheCurve = await mutableCurve.issueInEth(
        curveShareSize
      );
      const expectedInvestor1NeumarkShare = expectedNeumarkAmmountOnFixedRate
        .mul(equalShareSize)
        .div(expectedTicketsSum)
        .add(expectedNeumarkAmmountOnTheCurve)
        .div(2)
        .round(0, 4);

      const {
        commitment,
        lockedAccount
      } = await deployAllContracts(lockAdminAccount, whitelistAdminAccount, {
        commitmentCfg: {
          fixedInvestors: investorAccounts,
          fixedTickets: investorDeclaration,
          startTimestamp: startingDate
        }
      });
      await setTimeTo(startingDate);
      await commitment.commit({
        value: firstInvestorTicket,
        from: investorAccounts[0]
      });

      expect(
        await lockedAccount.balanceOf(investorAccounts[0])
      ).to.be.balanceWith({
        ether: firstInvestorTicket,
        neumarks: expectedInvestor1NeumarkShare
      });
    }

    // it should not accept ether send without data

    // check all events
  }
);

function accumulateGasPrice(tx, acc = new web3.BigNumber(0)) {
  return new web3.BigNumber(tx.receipt.gasUsed).add(acc);
}

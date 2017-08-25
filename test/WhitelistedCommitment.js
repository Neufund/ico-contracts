import { expect } from "chai";
import { last } from "lodash";
import EvmError from "./helpers/EVMThrow";
import { sequence } from "./helpers/promiseUtils";
import {
  closeFutureDate,
  furtherFutureDate,
  HOUR,
  MONTH
} from "./helpers/latestTime";
import { setTimeTo } from "./helpers/increaseTime";
import { etherToWei, shanToWei } from "./helpers/unitConverter";
import { deployAllContracts } from "./helpers/deploy";
import {
  curveInEther,
  deployMutableCurve,
  ethToEur,
  eurUlpToEth
} from "./helpers/verification";

contract("WhitelistedCommitment", ([_, owner, ...accounts]) => {
  describe("set ordered whitelist", () => {
    it("should work", async () => {
      const mutableCurve = await deployMutableCurve();
      const investors = [accounts[0], accounts[1]];
      const tickets = [etherToWei(1), etherToWei(2)];
      const expectedNeumarks = [
        await mutableCurve.issueInEth(tickets[0]),
        await mutableCurve.issueInEth(tickets[1])
      ];

      const { commitment, curve } = await deployAllContracts();
      await commitment.setOrderedWhitelist(investors, tickets);

      expect(await commitment.fixedCostInvestors(0)).to.be.eq(investors[0]);
      expect(await commitment.fixedCostInvestors(1)).to.be.eq(investors[1]);
      await expect(commitment.fixedCostInvestors).to.blockchainArrayOfSize(2);

      expect(
        await commitment.fixedCostTickets(investors[0])
      ).to.be.bignumber.eq(tickets[0]);
      expect(
        await commitment.fixedCostTickets(investors[1])
      ).to.be.bignumber.eq(tickets[1]);

      expect(
        await commitment.fixedCostNeumarks(investors[0])
      ).to.be.bignumber.eq(expectedNeumarks[0]);
      expect(
        await commitment.fixedCostNeumarks(investors[1])
      ).to.be.bignumber.eq(expectedNeumarks[1]);

      expect(await commitment.whitelisted(investors[0])).to.be.bignumber.eq(1);
      expect(await commitment.whitelisted(investors[1])).to.be.bignumber.eq(1);
    });

    it("should not be possible to set it twice", async () => {
      const { commitment, curve } = await deployAllContracts();
      const investors = [accounts[0], accounts[1]];
      const tickets = [etherToWei(1), etherToWei(2)];

      await commitment.setOrderedWhitelist(investors, tickets);

      await expect(commitment.setOrderedWhitelist(investors, tickets)).to.be.rejectedWith(
        EvmError
      );
    });

    it("should not be possible to set it after commitment is started", async () => {
      const startingDate = closeFutureDate();
      const { commitment, curve } = await deployAllContracts({
        commitmentCfg: { startTimestamp: startingDate }
      });
      const investors = [accounts[0], accounts[1]];
      const tickets = [etherToWei(1), etherToWei(2)];

      await setTimeTo(startingDate);

      await expect(commitment.setOrderedWhitelist(investors, tickets)).to.be.rejectedWith(
        EvmError
      );
    });

    it("should not be possible to set it with not matching input", async () => {
      const { commitment, curve } = await deployAllContracts();
      const investors = [accounts[0]];
      const tickets = [etherToWei(1), etherToWei(2)];

      await expect(commitment.setOrderedWhitelist(investors, tickets)).to.be.rejectedWith(
        EvmError
      );
    });
  });

  describe("set whitelisted investors", () => {
    it("should work", async () => {
      const { commitment } = await deployAllContracts();
      const investors = [accounts[0], accounts[1]];

      await commitment.setWhitelist(investors);

      expect(await commitment.whitelistedInvestors(0)).to.be.eq(investors[0]);
      expect(await commitment.whitelistedInvestors(1)).to.be.eq(investors[1]);
      await expect(commitment.whitelistedInvestors).to.blockchainArrayOfSize(2);

      expect(await commitment.whitelisted(investors[0])).to.be.bignumber.eq(1);
      expect(await commitment.whitelisted(investors[1])).to.be.bignumber.eq(1);

      await expect(commitment.fixedCostInvestors).to.blockchainArrayOfSize(0);
    });

    it("should not be possible to set it twice", async () => {
      const { commitment } = await deployAllContracts();
      const investors = [accounts[0], accounts[1]];

      await commitment.setWhitelist(investors);

      await expect(commitment.setWhitelist(investors)).to.be.rejectedWith(
        EvmError
      );
    });

    it("should not be possible to set it after commitment is started", async () => {
      const startingDate = closeFutureDate();
      const { commitment, curve } = await deployAllContracts({
        commitmentCfg: { startTimestamp: startingDate }
      });
      const investors = [accounts[0], accounts[1]];

      await setTimeTo(startingDate);

      await expect(commitment.setWhitelist(investors)).to.be.rejectedWith(
        EvmError
      );
    });
  });

  describe("set whitelist investor with fixed investors", () => {
    it("should be possible to whitelist investors before fixed investors", async () => {
      const { commitment } = await deployAllContracts();
      const whitelistedInvestors = [accounts[0], accounts[1]];
      const fixedInvestors = [accounts[2]];
      const fixedTickets = [etherToWei(1)];

      await commitment.setWhitelist(whitelistedInvestors);
      await commitment.setOrderedWhitelist(fixedInvestors, fixedTickets);

      expect(await commitment.whitelistedInvestors(0)).to.be.eq(
        whitelistedInvestors[0]
      );
      expect(await commitment.whitelistedInvestors(1)).to.be.eq(
        whitelistedInvestors[1]
      );
      await expect(commitment.whitelistedInvestors).to.blockchainArrayOfSize(2);

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
        await commitment.fixedCostTickets(fixedInvestors[0])
      ).to.be.bignumber.eq(fixedTickets[0]);
      expect(
        await commitment.fixedCostTickets(whitelistedInvestors[0])
      ).to.be.bignumber.eq(0);
      expect(
        await commitment.fixedCostTickets(whitelistedInvestors[1])
      ).to.be.bignumber.eq(0);
    });

    it("should be possible to whitelist investors after fixed investors", async () => {
      const { commitment } = await deployAllContracts();
      const whitelistedInvestors = [accounts[0], accounts[1]];
      const fixedInvestors = [accounts[2]];
      const fixedTickets = [etherToWei(1)];

      await commitment.setOrderedWhitelist(fixedInvestors, fixedTickets);
      await commitment.setWhitelist(whitelistedInvestors);

      expect(await commitment.whitelistedInvestors(0)).to.be.eq(
        whitelistedInvestors[0]
      );
      expect(await commitment.whitelistedInvestors(1)).to.be.eq(
        whitelistedInvestors[1]
      );
      await expect(commitment.whitelistedInvestors).to.blockchainArrayOfSize(2);

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
        await commitment.fixedCostTickets(fixedInvestors[0])
      ).to.be.bignumber.eq(fixedTickets[0]);
      expect(
        await commitment.fixedCostTickets(whitelistedInvestors[0])
      ).to.be.bignumber.eq(0);
      expect(
        await commitment.fixedCostTickets(whitelistedInvestors[1])
      ).to.be.bignumber.eq(0);
    });
  });

  describe("ordered whitelist commitment", () => {
    it("should work with tickets below declared", async () => {
      const startingDate = closeFutureDate();
      const mutableCurve = await deployMutableCurve();
      const fixedInvestors = [accounts[0], accounts[1]];
      const fixedDeclaredTickets = [etherToWei(2), etherToWei(3)];
      const actualInvestorsCommitments = [etherToWei(1), etherToWei(2)];
      const expectedNeumarkAmmountForDeclaredTickets = [
        await mutableCurve.issueInEth(fixedDeclaredTickets[0]),
        await mutableCurve.issueInEth(fixedDeclaredTickets[1])
      ];
      const expectedInvestorsNeumarkShares = [
        expectedNeumarkAmmountForDeclaredTickets[0]
          .mul(actualInvestorsCommitments[0])
          .div(fixedDeclaredTickets[0])
          .div(2)
          .round(0, 4),
        expectedNeumarkAmmountForDeclaredTickets[1]
          .mul(actualInvestorsCommitments[1])
          .div(fixedDeclaredTickets[1])
          .div(2)
          .round(0, 4)
      ];

      const { commitment, lockedAccount } = await deployAllContracts({
        commitmentCfg: {
          fixedInvestors,
          fixedTickets: fixedDeclaredTickets,
          startTimestamp: startingDate
        }
      });
      await setTimeTo(startingDate);
      await commitment.commit({
        value: actualInvestorsCommitments[0],
        from: fixedInvestors[0]
      });
      await commitment.commit({
        value: actualInvestorsCommitments[1],
        from: fixedInvestors[1]
      });

      expect(
        await lockedAccount.balanceOf(fixedInvestors[0])
      ).to.be.balanceWith({
        ether: actualInvestorsCommitments[0],
        neumarks: expectedInvestorsNeumarkShares[0]
      });
      expect(
        await lockedAccount.balanceOf(fixedInvestors[1])
      ).to.be.balanceWith({
        ether: actualInvestorsCommitments[1],
        neumarks: expectedInvestorsNeumarkShares[1]
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

      const { commitment, lockedAccount, neumark } = await deployAllContracts({
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

    it("should send all neumarks and zero ticket when neumarks remainder below threshold", async () => {
      const startingDate = closeFutureDate();
      const investor1 = accounts[0];
      const fixedInvestors = [investor1];
      const fixedDeclaredTickets = [etherToWei(2)];

      const { commitment, lockedAccount, neumark, curve } = await deployAllContracts({
        commitmentCfg: {
          fixedInvestors,
          fixedTickets: fixedDeclaredTickets,
          startTimestamp: startingDate,
          minTicket: etherToWei(0),
          eurEthRate: etherToWei(0.1) // sets up a rate allowing for rounding errors
        }
      });

      const expectedNeumarkAmmount = await curveInEther(fixedDeclaredTickets[0], await commitment.ethEURFraction());
      const expectedInvestor1NeumarkShare = expectedNeumarkAmmount
        .div(2)
        .round(0, 4)
      // use curve inverse to get weis producing less than 9000 neumarks which is
      // send out as remainder
      const etherDeclarationDiff = eurUlpToEth(await curve.rewindInverse(5), 0.1).round(0);
      console.log(etherDeclarationDiff);
      const actualInvestor1Commitment = fixedDeclaredTickets[0].sub(etherDeclarationDiff);

      await setTimeTo(startingDate);
      await commitment.commit({
        value: actualInvestor1Commitment,
        from: investor1
      });
      expect(await lockedAccount.balanceOf(investor1)).to.be.balanceWith({
        ether: actualInvestor1Commitment,
        neumarks: expectedInvestor1NeumarkShare
      });
      expect(await neumark.balanceOf(commitment.address)).to.be.bignumber.eq(
        new web3.BigNumber(0)
      );
      expect(await commitment.fixedCostTickets(investor1)).to.be.bignumber.equal(0);
      // if not zeroed investor1 can steal a small number of additional neumarks
      /* await commitment.commit({
        value: etherDeclarationDiff,
        from: investor1
      });*/
      // what's worse next investor will not be able to get all his neumarks as
      // those go from a general pool held by commitment contract
    });

    it("should work with ticket exactly the same as declared", async () => {
      const startingDate = closeFutureDate();
      const mutableCurve = await deployMutableCurve();
      const investor1 = accounts[0];
      const fixedInvestors = [investor1, accounts[1]];
      const fixedDeclaredTickets = [etherToWei(1.21981798), etherToWei(3)];
      const actualInvestor1Commitment = etherToWei(1.21981798);
      const expectedNeumarkAmmount = (await mutableCurve.issueInEth(
        actualInvestor1Commitment
      ))
        .div(2)
        .round(0, 4);

      const { commitment, lockedAccount } = await deployAllContracts({
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
        neumarks: expectedNeumarkAmmount
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
        (await verificationCurve.issueInEth(ticketSizes[0])).div(2).round(0, 4),
        (await verificationCurve.issueInEth(ticketSizes[1])).div(2).round(0, 4)
      ];

      const { commitment, lockedAccount } = await deployAllContracts({
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

      const { commitment, lockedAccount } = await deployAllContracts({
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

      const { commitment, lockedAccount } = await deployAllContracts({
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

      const { commitment, lockedAccount } = await deployAllContracts({
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
      } = await deployAllContracts({
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
      const expectedError = new web3.BigNumber(0);

      const { commitment, lockedAccount, curve } = await deployAllContracts({
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

  // it should not accept ether send without data

  // check all events
});

function accumulateGasPrice(tx, acc = new web3.BigNumber(0)) {
  return new web3.BigNumber(tx.receipt.gasUsed).add(acc);
}

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
  const expectedNeumarkAmmountIssuance = [
    ...(await sequence(investorDeclaration, mutableCurve.issueInEth)),
    await mutableCurve.issueInEth(curveShareSize)
  ];
  const expectedInvestor1NeumarkShare = new web3.BigNumber(0)
    .add(expectedNeumarkAmmountIssuance[0]) // fixed part
    .add(last(expectedNeumarkAmmountIssuance)) // curve part
    .div(2)
    .round(0, 4);

  const { commitment, lockedAccount } = await deployAllContracts({
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

  expect(await lockedAccount.balanceOf(investorAccounts[0])).to.be.balanceWith({
    ether: firstInvestorTicket,
    neumarks: expectedInvestor1NeumarkShare
  });
}

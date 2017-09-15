import { expect } from "chai";
import EvmError from "./helpers/EVMThrow";
import { eventValue } from "./helpers/events";
import {
  saveBlockchain,
  increaseTime,
  restoreBlockchain
} from "./helpers/evmCommands";
import { latestTimestamp } from "./helpers/latestTime";
import createAccessPolicy from "./helpers/createAccessPolicy";
import roles from "./helpers/roles";
import { prettyPrintGasCost } from "./helpers/gasUtils";

const EthereumForkArbiter = artifacts.require("EthereumForkArbiter");
const Neumark = artifacts.require("./Neumark.sol");
const EtherToken = artifacts.require("./EtherToken.sol");
const EuroToken = artifacts.require("./EuroToken.sol");
const LockedAccount = artifacts.require("./LockedAccount.sol");
const Commitment = artifacts.require("./Commitment.sol");

const Token = { Ether: 1, Euro: 2 };

const Q18 = web3.toBigNumber("10").pow(18);
const AGREEMENT = "ipfs:QmPXME1oRtoT627YKaDPDQ3PwA8tdP9rWuAAweLzqSwAWT";
const LOCK_DURATION = 18 * 30 * 24 * 60 * 60;
const BEFORE_DURATION = 5 * 24 * 60 * 60;
const PENALTY_FRACTION = web3.toBigNumber("0.1").mul(Q18);
const CAP_EUR = web3.toBigNumber("200000000").mul(Q18);
const MIN_TICKET_EUR = web3.toBigNumber("300").mul(Q18);
const ETH_EUR_FRACTION = web3.toBigNumber("300").mul(Q18);

contract(
  "Commitment",
  ([deployer, platform, whitelistAdmin, other, ...investors]) => {
    let snapshot;
    let rbac;
    let forkArbiter;
    let neumark;
    let etherToken;
    let euroToken;
    let etherLock;
    let euroLock;
    let commitment;

    describe.only("Contract", async () => {
      beforeEach(async () => {
        const now = await latestTimestamp();
        const startDate = now + BEFORE_DURATION;
        rbac = await createAccessPolicy([
          { subject: whitelistAdmin, role: roles.whitelistAdmin }
        ]);
        forkArbiter = await EthereumForkArbiter.new(rbac.address);
        neumark = await Neumark.new(
          rbac.address,
          forkArbiter.address,
          AGREEMENT
        );
        etherToken = await EtherToken.new(rbac.address);
        euroToken = await EuroToken.new(rbac.address);
        etherLock = await LockedAccount.new(
          rbac.address,
          forkArbiter.address,
          AGREEMENT,
          etherToken.address,
          neumark.address,
          LOCK_DURATION,
          PENALTY_FRACTION
        );
        euroLock = await LockedAccount.new(
          rbac.address,
          forkArbiter.address,
          AGREEMENT,
          euroToken.address,
          neumark.address,
          LOCK_DURATION,
          PENALTY_FRACTION
        );
        commitment = await Commitment.new(
          rbac.address,
          startDate,
          platform,
          neumark.address,
          etherToken.address,
          euroToken.address,
          etherLock.address,
          euroLock.address,
          CAP_EUR,
          MIN_TICKET_EUR,
          ETH_EUR_FRACTION
        );
        await rbac.set([
          { subject: commitment.address, role: roles.neumarkIssuer },
          { subject: commitment.address, role: roles.neumarkBurner }
        ]);
        // snapshot = await saveBlockchain();
      });

      beforeEach(async () => {
        // await restoreBlockchain(snapshot);
        // snapshot = await saveBlockchain();
      });

      it("should deploy", async () => {
        await prettyPrintGasCost("EuroToken deploy", commitment);
      });

      describe("addWhitelisted", async () => {
        it("should accept whitelist with zero investors", async () => {
          const tx = await commitment.addWhitelisted([], [], [], {
            from: whitelistAdmin
          });

          await prettyPrintGasCost("addWhitelisted", tx);
        });

        it("should accept whitelist with one investor", async () => {
          const N = 1;
          const whitelisted = Array(N).fill(0).map((_, i) => `0xFF${i}`);
          const tokens = Array(N)
            .fill(0)
            .map((_, i) => (i % 2 ? Token.Ether : Token.Euro));
          const amounts = Array(N)
            .fill(0)
            .map((_, i) =>
              web3.toBigNumber(i * i).mul(Q18).plus(MIN_TICKET_EUR)
            );
          const tx = await commitment.addWhitelisted(
            whitelisted,
            tokens,
            amounts,
            {
              from: whitelistAdmin
            }
          );

          await prettyPrintGasCost("addWhitelisted", tx);
        });

        it("should append whitelist twice", async () => {
          const N = 2;
          const whitelisted = Array(N).fill(0).map((_, i) => `0xFF${i}`);
          const tokens = Array(N)
            .fill(0)
            .map((_, i) => (i % 2 ? Token.Ether : Token.Euro));
          const amounts = Array(N)
            .fill(0)
            .map((_, i) =>
              web3.toBigNumber(i * i).mul(Q18).plus(MIN_TICKET_EUR)
            );

          await commitment.addWhitelisted(
            [whitelisted[0]],
            [tokens[0]],
            [amounts[0]],
            { from: whitelistAdmin }
          );
          await commitment.addWhitelisted(
            [whitelisted[1]],
            [tokens[1]],
            [amounts[1]],
            { from: whitelistAdmin }
          );
        });

        it("should accept whitelist with 100 investors", async () => {
          const N = 100;
          const whitelisted = Array(N).fill(0).map((_, i) => `0xFF${i}`);
          const tokens = Array(N)
            .fill(0)
            .map((_, i) => (i % 2 ? Token.Ether : Token.Euro));
          const amounts = Array(N)
            .fill(0)
            .map((_, i) =>
              web3.toBigNumber(i * i).mul(Q18).plus(MIN_TICKET_EUR)
            );

          for (let i = 0; i < N; i += 25) {
            await commitment.addWhitelisted(
              whitelisted.slice(i, i + 25),
              tokens.slice(i, i + 25),
              amounts.slice(i, i + 25),
              { from: whitelistAdmin }
            );
          }
        });

        it("should accept whitelist only from whitelist admin", async () => {
          const tx = commitment.addWhitelisted([], [], [], {
            from: other
          });

          expect(tx).to.be.rejectedWith(EvmError);
        });

        it("should accept whitelist only during Before", async () => {
          await increaseTime(BEFORE_DURATION);

          const tx = commitment.addWhitelisted([], [], [], {
            from: whitelistAdmin
          });

          await expect(tx).to.be.rejectedWith(EvmError);
        });

        it("should pre-allocate Nmk for whitelist", async () => {
          const whitelisted = [investors[0], investors[1]];
          const tokens = [Token.Ether, Token.Euro];
          const amounts = [Q18, Q18];
          const expectedEur = Q18.mul(ETH_EUR_FRACTION).div(Q18).plus(Q18);
          const expectedNmk = await neumark.cumulative(expectedEur);
          await commitment.addWhitelisted(whitelisted, tokens, amounts, {
            from: whitelistAdmin
          });

          const totalEur = await neumark.totalEuroUlps();
          const totalNmk = await neumark.totalSupply();
          const whitelistNmk = await neumark.balanceOf(commitment.address);

          expect(totalEur).to.be.bignumber.eq(expectedEur);
          expect(totalNmk).to.be.bignumber.eq(expectedNmk);
          expect(whitelistNmk).to.be.bignumber.eq(expectedNmk);
        });
      });

      describe("abort", async () => {
        it("should abort");
        it("should selfdestruct on abort");
        it("should burn neumarks on abort");
        it("should abort only by whitelist admin");
        it("should abort only Before");
      });

      describe("rollback", async () => {
        it("should roll back unfufilled Ether tickets on Pause");
        it("should roll back unfufilled Euro tickets on Rollback");
      });

      describe("commit (whitelisted)", async () => {
        beforeEach(async () => {
          const whitelisted = [investors[0]];
          const tokens = [Token.Ether];
          const amounts = [Q18, Q18];
          const expectedEur = Q18.mul(ETH_EUR_FRACTION).div(Q18).plus(Q18);
          const expectedNmk = await neumark.cumulative(expectedEur);
          await commitment.addWhitelisted(whitelisted, tokens, amounts, {
            from: whitelistAdmin
          });
        });

        it("should commit during Whitelist");
        it("should commit during Public");
        it("should commit during Rollback");
        it("should not commit during Before");
        it("should not commit during Pause");
        it("should not commit during Finished");
        it("should commit less than ticket");
        it("should commit in tranches");
        it("should commit more than ticket");
        it("should commit only from curve after Public");
        it("should commit Ether");
        it("should commit EtherToken");
        it("should commit Ether and EtherToken");
      });

      describe("commit (not whitelisted)", async () => {});

      describe("commitEuro (whitelisted)", async () => {});

      describe("commitEuro (not whitelisted)", async () => {});

      describe("cap", async () => {});
    });
  }
);

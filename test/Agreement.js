import { expect } from "chai";
import { eventValue, hasEvent } from "./helpers/events";
import { deployControlContracts } from "./helpers/deployContracts";
import EvmError from "./helpers/EVMThrow";
import { TriState } from "./helpers/triState";
import roles from "./helpers/roles";
import { promisify } from "./helpers/evmCommands";

const TestAgreement = artifacts.require("TestAgreement");

contract(
  "Agreement",
  ([_, platformOperatorRepresentative, signer1, signer2]) => {
    let agreement;
    let accessControl;
    let forkArbiter;

    beforeEach(async () => {
      [accessControl, forkArbiter] = await deployControlContracts();

      agreement = await TestAgreement.new(
        accessControl.address,
        forkArbiter.address
      );
      await accessControl.setUserRole(
        platformOperatorRepresentative,
        roles.platformOperatorRepresentative,
        agreement.address,
        TriState.Allow
      );
    });

    async function amendAgreement(agreementUri) {
      return agreement.amendAgreement(agreementUri, {
        from: platformOperatorRepresentative
      });
    }

    function expectAgreementAmendedEvent(tx, agreementUri) {
      const event = eventValue(tx, "LogAgreementAmended");
      expect(event).to.exist;
      expect(event.args.platformOperatorRepresentative).to.eq(
        platformOperatorRepresentative
      );
      expect(event.args.agreementUri).to.eq(agreementUri);
    }

    async function expectPastAgreement(agreementUri, timestamp, idx) {
      const agreementInfoByIndex = await agreement.pastAgreement.call(idx);
      expect(agreementInfoByIndex[0]).to.eq(platformOperatorRepresentative);
      expect(agreementInfoByIndex[1]).to.be.bignumber.eq(timestamp);
      expect(agreementInfoByIndex[2]).to.eq(agreementUri);
    }

    async function expectCurrentAgreement(agreementUri, timestamp) {
      const agreementInfo = await agreement.currentAgreement.call();
      expect(agreementInfo[0]).to.eq(platformOperatorRepresentative);
      expect(agreementInfo[1]).to.be.bignumber.eq(timestamp);
      expect(agreementInfo[2]).to.eq(agreementUri);
      await expectPastAgreement(agreementUri, timestamp, agreementInfo[3]);
    }

    function expectAgreementAcceptedEvent(tx, signer) {
      const event = eventValue(tx, "LogAgreementAccepted");
      expect(event).to.exist;
      expect(event.args.accepter).to.eq(signer);
    }

    async function expectAgreementAccepted(signer) {
      const signed = await agreement.isAgreementSignedBy.call(signer);
      expect(signed).to.be.true;
    }

    it("should amend agreement", async () => {
      const agreementUri =
        "txhash:0xa5b600fec63223ba2e7be527b90a2261c818c5491fce11852b2f96a472507cb7";
      const tx = await amendAgreement(agreementUri);
      const txBlock = await promisify(web3.eth.getBlock)(
        tx.receipt.blockNumber
      );
      expectAgreementAmendedEvent(tx, agreementUri);
      await expectCurrentAgreement(agreementUri, txBlock.timestamp);
    });

    it("should reject to amend from unknown account", async () => {
      const agreementUri =
        "txhash:0xa5b600fec63223ba2e7be527b90a2261c818c5491fce11852b2f96a472507cb7";
      await expect(
        agreement.amendAgreement(agreementUri, { from: signer2 })
      ).to.be.rejectedWith(EvmError);
    });

    it("should amend agreement twice", async () => {
      const agreementUri1 =
        "txhash:0xa5b600fec63223ba2e7be527b90a2261c818c5491fce11852b2f96a472507cb7";
      const tx1 = await amendAgreement(agreementUri1);
      const agreementUri2 = "http://till.com/articles/muse/";
      const tx2 = await amendAgreement(agreementUri2);
      const txBlock2 = await promisify(web3.eth.getBlock)(
        tx2.receipt.blockNumber
      );
      expectAgreementAmendedEvent(tx2, agreementUri2);
      await expectCurrentAgreement(agreementUri2, txBlock2.timestamp);
      const txBlock1 = await promisify(web3.eth.getBlock)(
        tx1.receipt.blockNumber
      );
      await expectPastAgreement(agreementUri1, txBlock1.timestamp, 0);
    });

    it("should sign agreement", async () => {
      const agreementUri =
        "txhash:0xa5b600fec63223ba2e7be527b90a2261c818c5491fce11852b2f96a472507cb7";
      await amendAgreement(agreementUri);
      const tx = await agreement.signMeUp({ from: signer1 });
      expectAgreementAcceptedEvent(tx, signer1);
      await expectAgreementAccepted(signer1);
    });

    it("should sign agreement once", async () => {
      const agreementUri =
        "txhash:0xa5b600fec63223ba2e7be527b90a2261c818c5491fce11852b2f96a472507cb7";
      await amendAgreement(agreementUri);
      await agreement.signMeUp({ from: signer1 });
      const tx = await agreement.signMeUp({ from: signer1 });
      expect(hasEvent(tx, "LogAgreementAccepted")).to.be.false;
      await expectAgreementAccepted(signer1);
    });

    it("should sign agreement once separate functions", async () => {
      const agreementUri =
        "txhash:0xa5b600fec63223ba2e7be527b90a2261c818c5491fce11852b2f96a472507cb7";
      await amendAgreement(agreementUri);
      await agreement.signMeUp({ from: signer1 });
      const tx = await agreement.signMeUpAgain({ from: signer1 });
      expect(hasEvent(tx, "LogAgreementAccepted")).to.be.false;
      await expectAgreementAccepted(signer1);
    });

    it("should sign agreement two signers", async () => {
      const agreementUri =
        "txhash:0xa5b600fec63223ba2e7be527b90a2261c818c5491fce11852b2f96a472507cb7";
      await amendAgreement(agreementUri);
      const tx1 = await agreement.signMeUp({ from: signer1 });
      expectAgreementAcceptedEvent(tx1, signer1);
      await expectAgreementAccepted(signer1);
      const tx2 = await agreement.signMeUpAgain({ from: signer2 });
      expectAgreementAcceptedEvent(tx2, signer2);
      await expectAgreementAccepted(signer2);
    });

    it("should reject to sign when no agreement", async () => {
      await expect(agreement.signMeUp({ from: signer1 })).to.be.rejectedWith(
        EvmError
      );
    });

    it("should reject current agreement when no agreement", async () => {
      await expect(agreement.currentAgreement.call()).to.be.rejectedWith(
        EvmError
      );
    });

    it("should revert when get agreement past last index", async () => {
      await expect(agreement.pastAgreement.call(0)).to.be.rejectedWith(
        EvmError
      );
    });
  }
);

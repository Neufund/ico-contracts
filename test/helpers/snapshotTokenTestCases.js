import { expect } from "chai";
import EvmError from "./EVMThrow";
import { ZERO_ADDRESS } from "./tokenTestCases";

export function snapshotTokenTests(
  getToken,
  createClone,
  advanceSnapshotId,
  owner,
  owner2,
  broker
) {
  let token;

  async function expectEmptyToken(emptyToken) {
    const initialSnapshotId = await emptyToken.currentSnapshotId.call();
    expect(
      await emptyToken.balanceOfAt.call(owner, initialSnapshotId)
    ).to.be.bignumber.eq(0);
    expect(
      await emptyToken.balanceOfAt.call(owner2, initialSnapshotId)
    ).to.be.bignumber.eq(0);
    expect(
      await emptyToken.totalSupplyAt.call(initialSnapshotId)
    ).to.be.bignumber.eq(0);
    expect(await emptyToken.balanceOf.call(owner)).to.be.bignumber.eq(0);
    expect(await emptyToken.balanceOf.call(owner2)).to.be.bignumber.eq(0);
    expect(await emptyToken.totalSupply.call()).to.be.bignumber.eq(0);
  }

  const expectTokenBalances = async (refToken, snapshots) => {
    // const allBalances = await refToken.allBalancesOf(owner);
    // console.log(allBalances);
    // console.log('-------------------');
    for (const snapshot of snapshots) {
      // console.log('-------------------');
      // console.log(snapshot);
      const snapshotId = snapshot[0];
      const balances = snapshot[1];
      expect(await refToken.totalSupplyAt(snapshotId)).to.be.bignumber.eq(
        balances[2]
      );
      expect(await refToken.balanceOfAt(owner2, snapshotId)).to.be.bignumber.eq(
        balances[1]
      );
      expect(await refToken.balanceOfAt(owner, snapshotId)).to.be.bignumber.eq(
        balances[0]
      );
    }
  };

  describe("general", () => {
    beforeEach(() => {
      token = getToken();
    });

    it("empty token", async () => {
      await expectEmptyToken(token);
    });

    it("should store historical balances", async () => {
      const snapshots = [];
      const initialSnapshotId = await token.currentSnapshotId.call();
      const supply = new web3.BigNumber(88172891);

      await token.deposit(supply, { from: owner });
      await token.transfer(owner2, 18281, { from: owner });
      snapshots.push([initialSnapshotId, [supply.sub(18281), 18281, supply]]);

      let snapshotId = await advanceSnapshotId(token);
      await token.approve(broker, 98128, { from: owner });
      await token.transferFrom(owner, owner2, 98128, { from: broker });
      snapshots.push([
        snapshotId,
        [supply.sub(18281 + 98128), 18281 + 98128, supply]
      ]);

      snapshotId = await advanceSnapshotId(token);
      snapshots.push([
        snapshotId,
        [supply.sub(18281 + 98128), 18281 + 98128, supply]
      ]);

      snapshotId = await advanceSnapshotId(token);
      await token.withdraw(8712, { from: owner2 });
      snapshots.push([
        snapshotId,
        [supply.sub(18281 + 98128), 18281 + 98128 - 8712, supply.sub(8712)]
      ]);

      snapshotId = await advanceSnapshotId(token);
      snapshots.push([
        snapshotId,
        [supply.sub(18281 + 98128), 18281 + 98128 - 8712, supply.sub(8712)]
      ]);

      await expectTokenBalances(token, snapshots);
    });

    it("should reject on future totalSupplyAt", async () => {
      const initialSnapshotId = await token.currentSnapshotId.call();
      await expect(
        token.totalSupplyAt(initialSnapshotId.add(1))
      ).to.be.rejectedWith(EvmError);
    });

    it("should reject on future balanceOfAt", async () => {
      const initialSnapshotId = await token.currentSnapshotId.call();
      await expect(
        token.balanceOfAt(owner, initialSnapshotId.add(1))
      ).to.be.rejectedWith(EvmError);
    });

    it("allBalances", async () => {
      // test may fail if executed on day boundary....
      let totalDeposit = new web3.BigNumber(0);
      const referenceBalances = [];
      for (let ii = 0; ii < 15; ii += 1) {
        const snapshotId = await token.currentSnapshotId.call();
        // not less than 1 so there is always deposit
        const toDeposit = new web3.BigNumber(
          Math.floor(Math.random() * 129837981983) + 1
        );
        await token.deposit(toDeposit, { from: owner });
        totalDeposit = totalDeposit.add(toDeposit);
        referenceBalances.push([snapshotId, totalDeposit]);
        await advanceSnapshotId(token);
      }
      const allBalances = await token.allBalancesOf.call(owner);
      expect(allBalances).to.deep.eq(referenceBalances);
    });
  });

  describe("cloning", () => {
    beforeEach(() => {
      token = getToken();
    });

    it("should clone", async () => {
      const snapshots = [];
      const initialSnapshotId = await token.currentSnapshotId.call();
      const supply = new web3.BigNumber(88172891);

      await token.deposit(supply, { from: owner });
      await token.transfer(owner2, 18281, { from: owner });
      snapshots.push([initialSnapshotId, [supply.sub(18281), 18281, supply]]);

      let snapshotId = await advanceSnapshotId(token);
      await token.transfer(owner2, 98128, { from: owner });
      // mind line below - this snapshot will be skipped by the clone so we expect initial values in the clone
      snapshots.push([snapshotId, [supply.sub(18281), 18281, supply]]);
      // create clone at initialSnapshotId
      const clonedToken = await createClone(token, 0);
      const clonedAtSnapshotId = (await token.currentSnapshotId()).sub(1);
      expect(await clonedToken.parentSnapshotId.call()).to.be.bignumber.eq(
        clonedAtSnapshotId
      );
      // tokens already diverged
      expect(
        await clonedToken.balanceOfAt(owner2, snapshotId)
      ).to.be.bignumber.eq(18281);
      expect(await token.balanceOfAt(owner2, snapshotId)).to.be.bignumber.eq(
        18281 + 98128
      );

      snapshotId = await advanceSnapshotId(clonedToken);
      // owner2 zeroes account
      await clonedToken.transfer(owner, 18281, { from: owner2 });
      snapshots.push([snapshotId, [supply, 0, supply]]);

      // tokens further diverge
      snapshotId = await advanceSnapshotId(clonedToken);
      await clonedToken.withdraw(1, { from: owner });
      snapshots.push([snapshotId, [supply.sub(1), 0, supply.sub(1)]]);

      await expectTokenBalances(clonedToken, snapshots);
    });

    it("should clone empty token", async () => {
      const snapshots = [];
      const clonedToken = await createClone(token, 0);
      await expectEmptyToken(clonedToken);

      const initialSnapshotId = await token.currentSnapshotId.call();
      const supply = new web3.BigNumber(88172891);
      await clonedToken.deposit(supply, { from: owner });
      await clonedToken.transfer(owner2, 18281, { from: owner });
      snapshots.push([initialSnapshotId, [supply.sub(18281), 18281, supply]]);

      await expectTokenBalances(clonedToken, snapshots);
    });

    it("should clone token with single current snapshot", async () => {
      const snapshots = [];
      const initialSnapshotId = await token.currentSnapshotId.call();
      const supply = new web3.BigNumber(88172891);
      await token.deposit(supply, { from: owner });
      await token.transfer(owner2, 18281, { from: owner });

      const clonedToken = await createClone(token, 0);
      await expectEmptyToken(clonedToken);

      const clonedSupply = new web3.BigNumber(97878678826);
      await clonedToken.deposit(clonedSupply, { from: owner });
      await clonedToken.transfer(owner2, 18281, { from: owner });
      snapshots.push([
        initialSnapshotId,
        [clonedSupply.sub(18281), 18281, clonedSupply]
      ]);

      await expectTokenBalances(clonedToken, snapshots);
    });

    it("should clone past snapshot", async () => {
      const snapshots = [];
      const initialSnapshotId = await token.currentSnapshotId.call();
      const supply = new web3.BigNumber(88172891);

      await token.deposit(supply, { from: owner });
      await token.transfer(owner2, 18281, { from: owner });
      snapshots.push([initialSnapshotId, [supply.sub(18281), 18281, supply]]);

      let snapshotId = await advanceSnapshotId(token);
      await token.transfer(owner2, 98128, { from: owner });
      // mind line below - this snapshot will be skipped by the clone so we expect initial values in the clone
      snapshots.push([snapshotId, [supply.sub(18281), 18281, supply]]);

      snapshotId = await advanceSnapshotId(token);
      await token.transfer(owner2, 6718, { from: owner });
      // mind line below - this snapshot will be skipped by the clone so we expect initial values in the clone
      snapshots.push([snapshotId, [supply.sub(18281), 18281, supply]]);

      // create clone at initialSnapshotId
      const clonedToken = await createClone(token, initialSnapshotId);
      expect(await clonedToken.parentSnapshotId.call()).to.be.bignumber.eq(
        initialSnapshotId
      );
      // but clonedToken actual snapshot is snapshotId like parent
      expect(await clonedToken.currentSnapshotId.call()).to.be.bignumber.eq(
        snapshotId
      );

      // tokens already diverged
      expect(
        await clonedToken.balanceOfAt(owner2, snapshotId)
      ).to.be.bignumber.eq(18281);
      expect(await token.balanceOfAt(owner2, snapshotId)).to.be.bignumber.eq(
        18281 + 98128 + 6718
      );

      snapshotId = await advanceSnapshotId(clonedToken);
      // owner2 zeroes account
      await clonedToken.transfer(owner, 18281, { from: owner2 });
      snapshots.push([snapshotId, [supply, 0, supply]]);

      // tokens further diverge
      snapshotId = await advanceSnapshotId(clonedToken);
      await clonedToken.withdraw(1, { from: owner });
      snapshots.push([snapshotId, [supply.sub(1), 0, supply.sub(1)]]);

      await expectTokenBalances(clonedToken, snapshots);
    });

    async function attemptToDesyncClone(clonedToken) {
      // note - following procedure will desync cloned token if we allow to change its state before state of parent
      // it points to is sealed due to snapshot id advance
      // state change before sealing is now blocked and operations below will throw
      // decouple total supply of clone and owner2
      await clonedToken.deposit(1, { from: owner2 });
      await clonedToken.withdraw(2, { from: owner2 });
      // transfer to owner which is still coupled in parent
      await token.transfer(owner, 100, { from: owner2 });
      // notice totalSupply in the clone does not hold: it sees owner from the parent and owner2 from the clone
      // 100 wei is lost
      const clonedOwnedBalance = await clonedToken.balanceOf(owner);
      const clonedOwned2Balance = await clonedToken.balanceOf(owner2);

      // expect(await clonedToken.totalSupply()).to.be.bignumber.eq(clonedOwnedBalance.add(clonedOwned2Balance).sub(100));
      expect(await clonedToken.totalSupply()).to.be.bignumber.eq(
        clonedOwnedBalance.add(clonedOwned2Balance)
      );
    }

    async function expectCloneFreeze(snapshotId, futureDelta) {
      // create clone at current snapshotId
      const clonedToken = await createClone(token, snapshotId.add(futureDelta));
      await token.transfer(owner2, 98128, { from: owner });
      expect(
        await clonedToken.balanceOfAt(owner2, snapshotId)
      ).to.be.bignumber.eq(18281 + 98128);
      expect(await token.balanceOfAt(owner2, snapshotId)).to.be.bignumber.eq(
        18281 + 98128
      );
      // all state changes to clone must be blocked until parent is sealed
      await expect(
        clonedToken.withdraw(1, { from: owner2 })
      ).to.be.rejectedWith(EvmError);
      await expect(clonedToken.deposit(1, { from: owner2 })).to.be.rejectedWith(
        EvmError
      );
      await expect(
        clonedToken.transfer(owner2, 1, { from: owner })
      ).to.be.rejectedWith(EvmError);
      await expect(attemptToDesyncClone(clonedToken)).to.be.rejectedWith(
        EvmError
      );
      let advancedBy = futureDelta + 1;
      while (advancedBy > 0) {
        await advanceSnapshotId(token);
        advancedBy -= 1;
      }
      await clonedToken.withdraw(1, { from: owner2 });
      await clonedToken.deposit(1, { from: owner2 });
      await clonedToken.transfer(owner2, 1, { from: owner });
      await attemptToDesyncClone(clonedToken);
    }

    it("should freeze clone on current snapshot id", async () => {
      const supply = new web3.BigNumber(8172891);

      await token.deposit(supply, { from: owner });
      await token.transfer(owner2, 18281, { from: owner });
      const snapshotId = await advanceSnapshotId(token);
      await expectCloneFreeze(snapshotId, 0);
    });

    it("should reject to clone on future snapshot id", async () => {
      const supply = new web3.BigNumber(8172891);

      await token.deposit(supply, { from: owner });
      await token.transfer(owner2, 18281, { from: owner });
      const snapshotId = await advanceSnapshotId(token);

      await expectCloneFreeze(snapshotId, 1);
    });

    it("should decouple cloned token", async () => {
      const clonedSnapshots = [];
      const parentSnapshots = [];
      const clonedToken = await createClone(token, 0);

      const initialSnapshotId = await token.currentSnapshotId.call();

      // both tokens should have independent balances (clone point is at 0 distribution)
      const clonedSupply = new web3.BigNumber(88172891);
      await clonedToken.deposit(clonedSupply, { from: owner });
      await clonedToken.transfer(owner2, 18281, { from: owner });
      clonedSnapshots.push([
        initialSnapshotId,
        [clonedSupply.sub(18281), 18281, clonedSupply]
      ]);
      const parentSupply = new web3.BigNumber(9827121);
      await token.deposit(parentSupply, { from: owner2 });
      await token.transfer(owner, 651, { from: owner2 });
      parentSnapshots.push([
        initialSnapshotId,
        [651, parentSupply.sub(651), parentSupply]
      ]);

      let snapshotId = await advanceSnapshotId(token);
      parentSnapshots.push([
        snapshotId,
        [651, parentSupply.sub(651), parentSupply]
      ]);
      snapshotId = await advanceSnapshotId(clonedToken);
      await clonedToken.transfer(owner, 1, { from: owner2 });
      clonedSnapshots.push([
        snapshotId,
        [clonedSupply.sub(18280), 18280, clonedSupply]
      ]);

      snapshotId = await advanceSnapshotId(token);
      await token.withdraw(9273, { from: owner2 });
      parentSnapshots.push([
        snapshotId,
        [651, parentSupply.sub(651 + 9273), parentSupply.sub(9273)]
      ]);
      snapshotId = await advanceSnapshotId(clonedToken);
      clonedSnapshots.push([
        snapshotId,
        [clonedSupply.sub(18280), 18280, clonedSupply]
      ]);

      await expectTokenBalances(clonedToken, clonedSnapshots);
      await expectTokenBalances(token, parentSnapshots);
    });

    it("should clone at gap", async () => {
      // snapshotIds are strictly increasing but not consecutive
      const clonedSnapshots = [];

      const supply = new web3.BigNumber(892371121);
      await token.deposit(supply, { from: owner2 });
      await advanceSnapshotId(token);
      const clonedSnapshotId = await advanceSnapshotId(token);
      await advanceSnapshotId(token);
      await token.transfer(owner, 81763, { from: owner2 });
      await advanceSnapshotId(token);
      // point at gap - there's no physical snapshot at clonedSnapshotId
      const clonedToken = await createClone(token, clonedSnapshotId);
      await advanceSnapshotId(token);
      let snapshotId = await advanceSnapshotId(clonedToken);
      clonedSnapshots.push([snapshotId, [0, supply, supply]]);
      snapshotId = await advanceSnapshotId(clonedToken);
      await clonedToken.withdraw(100, { from: owner2 });
      clonedSnapshots.push([snapshotId, [0, supply.sub(100), supply.sub(100)]]);

      await expectTokenBalances(clonedToken, clonedSnapshots);
    });

    it("should clone multiple times", async () => {
      const snapshots = [];
      const initialSnapshotId = await token.currentSnapshotId.call();
      const supply = new web3.BigNumber(88172891);

      await token.deposit(supply, { from: owner });
      await token.transfer(owner2, 18281, { from: owner });
      snapshots.push([initialSnapshotId, [supply.sub(18281), 18281, supply]]);

      let snapshotId = await advanceSnapshotId(token);
      await token.transfer(owner2, 98128, { from: owner });
      // mind line below - this snapshot will be skipped by the clone so we expect initial values in the clone
      snapshots.push([snapshotId, [supply.sub(18281), 18281, supply]]);
      // create clone at initialSnapshotId
      const clonedToken = await createClone(token, 0);

      snapshotId = await advanceSnapshotId(clonedToken);
      // owner2 zeroes account
      await clonedToken.transfer(owner, 18281, { from: owner2 });
      snapshots.push([snapshotId, [supply, 0, supply]]);

      snapshotId = await advanceSnapshotId(clonedToken);
      await clonedToken.withdraw(1, { from: owner });
      // mind line below - this snapshot will be skipped by the secondary clone clone so we expect initial values in the clone
      snapshots.push([snapshotId, [supply, 0, supply]]);
      const clonedClonedToken = await createClone(clonedToken, 0);

      snapshotId = await advanceSnapshotId(clonedClonedToken);
      // owner2 zeroes account
      await clonedClonedToken.transfer(owner2, 1, { from: owner });
      snapshots.push([snapshotId, [supply.sub(1), 1, supply]]);

      await expectTokenBalances(clonedClonedToken, snapshots);
      expect(await clonedClonedToken.parentToken()).to.eq(clonedToken.address);
      expect(await clonedToken.parentToken()).to.eq(token.address);
      expect(await token.parentToken()).to.eq(ZERO_ADDRESS);
    });
  });
}

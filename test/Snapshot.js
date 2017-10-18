import { expect } from "chai";
import moment from "moment";
import { prettyPrintGasCost } from "./helpers/gasUtils";
import { latestTimestamp } from "./helpers/latestTime";
import increaseTime, { setTimeTo } from "./helpers/increaseTime";
import { eventValue } from "./helpers/events";
import EvmError from "./helpers/EVMThrow";

const TestSnapshot = artifacts.require("TestSnapshot");

const day = 24 * 3600;

contract("Snapshot", () => {
  let snapshotTest;

  const getSnapshotIdFromEvent = tx =>
    eventValue(tx, "LogSnapshotCreated", "snapshotId");

  const createSnapshot = async () => {
    const r = await snapshotTest.createSnapshot();
    assert.equal(r.logs.length, 1);
    return getSnapshotIdFromEvent(r);
  };

  beforeEach(async () => {
    snapshotTest = await TestSnapshot.new();
  });

  it("should deploy", async () => {
    prettyPrintGasCost("createSnapshot", snapshotTest);
  });

  it("should be initially unset", async () => {
    assert.isFalse(await snapshotTest.hasValue.call());
  });

  it("should initially return default", async () => {
    assert.equal(12, await snapshotTest.getValue.call(12));
    assert.equal(42, await snapshotTest.getValue.call(42));
  });

  it("should return correct snapshot id via snapshotAt", async () => {
    // encodes day number from unix epoch on 128 MSB of 256 word
    // day boundary on 00:00 UTC
    function encodeSnapshotId(noOfDays) {
      return new web3.BigNumber(2).pow(128).mul(noOfDays);
    }

    async function expectDays(timestamp, expectedNoOfDays) {
      const snapshotId = await snapshotTest.snapshotAt(timestamp);
      const expectedSnapshotId = encodeSnapshotId(expectedNoOfDays);
      expect(snapshotId).to.be.bignumber.eq(expectedSnapshotId);
    }
    await expectDays(1107795768, 12821);
    await expectDays(0, 0);
    await expectDays(1, 0);
    // get timestamp from UTC time
    const utcDayBoundaryTimestamp = Math.floor(Date.UTC(2017, 11, 15) / 1000);
    const utcDayCount = Math.floor(utcDayBoundaryTimestamp / (24 * 60 * 60));
    await expectDays(utcDayBoundaryTimestamp - 1, utcDayCount - 1);
    await expectDays(utcDayBoundaryTimestamp, utcDayCount);
    await expectDays(utcDayBoundaryTimestamp + 1, utcDayCount);
    await expectDays(utcDayBoundaryTimestamp + 24 * 60 * 60, utcDayCount + 1);
  });

  it("should initially return default when queried by snapshot id", async () => {
    const day0 = await snapshotTest.snapshotAt.call(
      (await latestTimestamp()) + 0 * day
    );
    expect(await snapshotTest.getValueAt.call(day0, 41)).to.be.bignumber.eq(41);
  });

  it("should create a snapshot", async () => {
    const r = await snapshotTest.createSnapshot();
    prettyPrintGasCost("createSnapshot", r);
  });

  it("should set a new value", async () => {
    const r = await snapshotTest.setValue(1234);

    prettyPrintGasCost("Setting new value should of ", r);

    assert.equal(1234, await snapshotTest.getValue.call(12));
    assert.isTrue(await snapshotTest.hasValue.call());
  });

  it("should overwrite last snapshot", async () => {
    const tx1 = await snapshotTest.setValue(1234);
    const snapshotId1 = getSnapshotIdFromEvent(tx1);

    const tx2 = await snapshotTest.setValue(12345);
    const snapshotId2 = await snapshotTest.currentSnapshotId.call();
    prettyPrintGasCost("overwrite last snapshot", tx2);

    expect(await snapshotTest.getValue.call(12)).to.be.bignumber.eq(12345);
    assert.isTrue(await snapshotTest.hasValue.call());
    expect(snapshotId1).to.be.bignumber.eq(snapshotId2);
  });

  it("should keep values in snapshots", async () => {
    const before = await createSnapshot();
    await snapshotTest.setValue(100);
    const middle = await createSnapshot();
    await snapshotTest.setValue(200);
    const after = await createSnapshot();

    assert.isFalse(await snapshotTest.hasValueAt.call(before.sub(1)));
    assert.isTrue(await snapshotTest.hasValueAt.call(before));
    assert.isTrue(await snapshotTest.hasValueAt.call(middle.sub(1)));
    assert.isTrue(await snapshotTest.hasValueAt.call(middle));
    assert.isTrue(await snapshotTest.hasValueAt.call(after.sub(1)));
    expect(
      await snapshotTest.getValueAt.call(before.sub(1), 41)
    ).to.be.bignumber.eq(41);
    expect(await snapshotTest.getValueAt.call(before, 41)).to.be.bignumber.eq(
      100
    );
    expect(
      await snapshotTest.getValueAt.call(middle.sub(1), 41)
    ).to.be.bignumber.eq(100);
    expect(await snapshotTest.getValueAt.call(middle, 41)).to.be.bignumber.eq(
      200
    );
    expect(
      await snapshotTest.getValueAt.call(after.sub(1), 41)
    ).to.be.bignumber.eq(200);
  });

  it("should create daily snapshots", async () => {
    const currentTimestamp = await latestTimestamp();

    const day0 = await snapshotTest.snapshotAt.call(currentTimestamp + 0 * day);
    const tx0 = await snapshotTest.setValue(100);
    const snapshotId0 = getSnapshotIdFromEvent(tx0);
    expect(snapshotId0).to.be.bignumber.eq(day0);

    const day1 = await snapshotTest.snapshotAt.call(currentTimestamp + 1 * day);
    await increaseTime(moment.duration({ days: 1 }));
    const tx1 = await snapshotTest.setValue(200);
    const snapshotId1 = getSnapshotIdFromEvent(tx1);
    expect(snapshotId1).to.be.bignumber.eq(day1);

    const day2 = await snapshotTest.snapshotAt.call(currentTimestamp + 2 * day);
    await increaseTime(moment.duration({ days: 1 }));
    const tx2 = await snapshotTest.setValue(300);
    const snapshotId2 = getSnapshotIdFromEvent(tx2);
    expect(snapshotId2).to.be.bignumber.eq(day2);

    const day3 = await snapshotTest.snapshotAt.call(currentTimestamp + 3 * day);

    expect(
      await snapshotTest.getValueAt.call(day0.sub(1), 41)
    ).to.be.bignumber.eq(41);
    expect(await snapshotTest.getValueAt.call(day0, 41)).to.be.bignumber.eq(
      100
    );
    expect(await snapshotTest.getValueAt.call(day1, 41)).to.be.bignumber.eq(
      200
    );
    expect(await snapshotTest.getValueAt.call(day2, 41)).to.be.bignumber.eq(
      300
    );
    expect(await snapshotTest.getValue.call(41)).to.be.bignumber.eq(300);
    await expect(snapshotTest.getValueAt.call(day3, 41)).to.be.rejectedWith(
      EvmError
    );
  });

  it("should throw when queried in the future", async () => {
    const ct = await latestTimestamp();
    const day1 = await snapshotTest.snapshotAt.call(ct + 1 * day);
    await expect(snapshotTest.getValueAt.call(day1, 41)).to.be.rejectedWith(
      EvmError
    );
    await expect(snapshotTest.hasValueAt.call(day1)).to.be.rejectedWith(
      EvmError
    );
  });

  it("should not delete interim value when set to previous value", async () => {
    // this test may fail if betweend createSnapshot() and setValue() there is a day boundary
    await createSnapshot();
    await snapshotTest.setValue(100);
    await createSnapshot();
    await snapshotTest.setValue(200);
    const after = await createSnapshot();
    await snapshotTest.setValue(100);
    await snapshotTest.setValue(200);

    const afterValue = await snapshotTest.getValueAt.call(after, -1);
    expect(afterValue).to.be.bignumber.eq(200);

    await snapshotTest.setValue(101);
    const afterValueChanged = await snapshotTest.getValueAt.call(after, -1);
    expect(afterValueChanged).to.be.bignumber.eq(101);

    const postMortem = await createSnapshot();
    // no snapshot were created after after
    expect(postMortem).to.be.bignumber.eq(after.add(1));
  });

  it("should perform approximate binary search", async () => {
    // this search must return previous value for approximate matches
    // due to end condition it's never O(1)
    // so let's test it
    const binSearch = (values, value) => {
      let min = 0;
      let max = values.length - 1;
      let iter = 0;
      while (max > min) {
        // eslint-disable-next-line no-bitwise
        const mid = (max + min + 1) >> 1;
        if (values[mid] <= value) {
          min = mid;
        } else {
          max = mid - 1;
        }
        iter += 1;
      }
      return [min, iter];
    };

    const days = Array.from(new Array(100), (x, i) => i * 2 ** 4);
    let avgIters = 0;
    for (let ii = 0; ii < days.length * 2 ** 4; ii += 1) {
      const r = binSearch(days, ii);
      // use linear search to verify
      const expectedIdx = days.findIndex(e => ii - e < 2 ** 4 && ii >= e);
      expect(r[0]).to.eq(expectedIdx);
      avgIters += r[1];
    }
    // eslint-disable-next-line no-console
    console.log(
      `\tAverage searches ${avgIters /
        (days.length * 2 ** 4)} vs theoretical O(log N) ${Math.log2(
        days.length
      )}`
    );
  });

  it("should create 100 daily snapshots with deterministic snapshot id", async () => {
    const day0 = await snapshotTest.snapshotAt.call(await latestTimestamp());
    const simulatedDays = 100; // 365*10;
    for (let ii = 0; ii < simulatedDays; ii += 1) {
      await snapshotTest.setValue(ii * 10 + 1);
      await increaseTime(moment.duration({ days: 1 }));
    }
    const daysMsb = new web3.BigNumber(2).pow(128);
    // make sure all boundaries crossed
    const expectedSnapshotId = day0.add(daysMsb.mul(simulatedDays));
    expect(await snapshotTest.currentSnapshotId()).to.be.bignumber.eq(
      expectedSnapshotId
    );
  });

  it("should return value read between non consecutive snapshot ids", async () => {
    const day0 = await snapshotTest.snapshotAt.call(
      (await latestTimestamp()) + 0 * day
    );
    const day1 = await snapshotTest.snapshotAt.call(
      (await latestTimestamp()) + 1 * day
    );

    await snapshotTest.setValue(100);
    await increaseTime(moment.duration({ days: 1 }));
    await snapshotTest.setValue(200);

    expect(
      await snapshotTest.getValueAt.call(day0.add(1), 41)
    ).to.be.bignumber.eq(100);
    expect(
      await snapshotTest.getValueAt.call(day0.add(day1.sub(day0).div(2)), 41)
    ).to.be.bignumber.eq(100);
    expect(
      await snapshotTest.getValueAt.call(day1.sub(1), 41)
    ).to.be.bignumber.eq(100);
  });

  it("should return value for snapshot ids after last physical entry was created", async () => {
    const day0 = await snapshotTest.snapshotAt.call(
      (await latestTimestamp()) + 0 * day
    );
    await snapshotTest.setValue(100);
    await snapshotTest.createSnapshot();
    expect(
      await snapshotTest.getValueAt.call(day0.add(1), 41)
    ).to.be.bignumber.eq(100);
  });

  it("should correctly create snapshots around day boundary", async () => {
    const boundary = Math.floor((await latestTimestamp()) / day + 1) * day;
    // set time to 3s before boundary
    await setTimeTo(boundary - 3);
    // test may fail if block is mined longer than 3 seconds
    const befTx = await snapshotTest.setValue(100);
    // 3 seconds into day boundary
    await increaseTime(3);
    const aftTx = await snapshotTest.setValue(200);
    const befSnapshotId = getSnapshotIdFromEvent(befTx);
    const aftSnapshotId = getSnapshotIdFromEvent(aftTx);
    // should have 1 day difference
    expect(aftSnapshotId.sub(befSnapshotId)).to.be.bignumber.eq(
      new web3.BigNumber(2).pow(128)
    );
  });
});

import { expect } from "chai";
import { txGasCost } from "./helpers/gasCost";
import { latestTimestamp } from "./helpers/latestTime";
import increaseTime from "./helpers/increaseTime";
import moment from "moment";
import expectThrow from "./helpers/expectThrow";

const SnapshotTest = artifacts.require("./test/SnapshotTest.sol");

const day = 24 * 3600;

contract("Snapshot", () => {
  let value;

  const createSnapshot = async () => {
    const r = await value.createSnapshot();
    assert.equal(r.logs.length, 1);
    assert.equal(r.logs[0].event, "SnapshotCreated");
    return r.logs[0].args.snapshot;
  };

  beforeEach(async () => {
    value = await SnapshotTest.new();
  });

  it("should be initially unset", async () => {
    assert.isFalse(await value.hasValue.call());
  });

  it("should initially return default", async () => {
    assert.isFalse(await value.hasValue.call());
  });

  it("should initially return default", async () => {
    assert.equal(12, await value.getValue.call(12));
    assert.equal(42, await value.getValue.call(42));
  });

  it("should create a snapshot", async () => {
    const r = await value.createSnapshot();
    expect(txGasCost(r)).to.be.eq(22869);
  });

  it("should set a new value", async () => {
    const r = await value.setValue(1234);

    expect(txGasCost(r)).to.be.eq(102855);

    assert.equal(1234, await value.getValue.call(12));
    assert.isTrue(await value.hasValue.call());
  });

  it("should reset value", async () => {
    await value.setValue(1234);

    const r = await value.setValue(12345);
    expect(txGasCost(r)).to.be.eq(27616);

    assert.equal(12345, await value.getValue.call(12));
    assert.isTrue(await value.hasValue.call());
  });

  it("should keep values in snapshots", async () => {
    const before = await createSnapshot();
    await value.setValue(100);
    const middle = await createSnapshot();
    await value.setValue(200);
    const after = await createSnapshot();

    assert.isFalse(await value.hasValueAt.call(before));
    assert.isTrue(await value.hasValueAt.call(middle));
    assert.isTrue(await value.hasValueAt.call(after));
    assert.equal(41, await value.getValueAt.call(before, 41));
    assert.equal(100, await value.getValueAt.call(middle, 41));
    assert.equal(200, await value.getValueAt.call(after, 41));
  });

  it("should create daily snapshots", async () => {
    const day0 = await value.snapshotAt.call(latestTimestamp() + 0 * day);
    const day1 = await value.snapshotAt.call(latestTimestamp() + 1 * day);
    const day2 = await value.snapshotAt.call(latestTimestamp() + 2 * day);
    const day3 = await value.snapshotAt.call(latestTimestamp() + 3 * day);
    await value.setValue(100);
    await increaseTime(moment.duration({ days: 1 }));
    await value.setValue(200);
    await increaseTime(moment.duration({ days: 1 }));
    await value.setValue(300);

    assert.equal(41, await value.getValueAt.call(day0, 41));
    assert.equal(100, await value.getValueAt.call(day1, 41));
    assert.equal(200, await value.getValueAt.call(day2, 41));
  });

  it("should throw when queried in the future", async () => {
    const day1 = await value.snapshotAt.call(latestTimestamp() + 1 * day);
    await expectThrow(value.getValueAt.call(day1, 41));
  });
});

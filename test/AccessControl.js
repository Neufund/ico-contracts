import { expect } from "chai";
import EvmError from "./helpers/EVMThrow";
import eventValue from "./helpers/eventValue";

const RoleBasedAccessControl = artifacts.require("RoleBasedAccessControl");
const TestAccessControlTruffleMixin = artifacts.require("TestAccessControlTruffleMixin");

contract("AccessControl", ([accessController, owner1, owner2]) => {
  let accessControl;
  let accessControlled;
  let exampleRole;

  beforeEach(async () => {
    accessControl = await RoleBasedAccessControl.new();
    accessControlled = await TestAccessControlTruffleMixin.new(accessControl.address);

    exampleRole = await accessControlled.ROLE_EXAMPLE();
  });

  function expectAccessChangedEvent(tx, subject, role, object, oldValue, newValue) {
    const event = eventValue(tx, "AccessChanged");
    expect(event).to.exist;
    expect(event.args.controller).to.equal(accessController);
    expect(event.args.subject).to.equal(subject);
    expect(event.args.role).to.equal(role);
    expect(event.args.object).to.equal(object);
    expect(event.args.oldValue).to.be.bignumber.equal(oldValue);
    expect(event.args.newValue).to.be.bignumber.equal(newValue);
  }

  function expectAccessEvent(tx, subject, role, object) {
    const event = eventValue(tx, "Access");
    expect(event).to.exist;
    expect(event.args.subject).to.equal(subject);
    expect(event.args.role).to.equal(role);
    expect(event.args.object).to.equal(object);
  }

  it("should allow owner1", async () => {
    let tx = await accessControl.setUserRole(owner1, exampleRole, accessControlled.address, 1);
    expectAccessChangedEvent(tx, owner1, exampleRole, accessControlled.address, 0, 1);
    tx = await accessControlled.someFunction({from: owner1});
    // tx = await expect().to.be.ok;
    expectAccessEvent(tx, owner1, exampleRole, accessControlled.address);
  });

  it("should disallow owner2", async () => {
    let tx = await accessControl.setUserRole(owner1, exampleRole, accessControlled.address, 1);
    expectAccessChangedEvent(tx, owner1, exampleRole, accessControlled.address, 0, 1);
    await expect(accessControlled.someFunction({from: owner2})).to.be.rejectedWith(EvmError);
  });

  it("should explicitly disallow owner2", async () => {
    let tx = await accessControl.setUserRole(owner2, exampleRole, accessControlled.address, 2);
    expectAccessChangedEvent(tx, owner2, exampleRole, accessControlled.address, 0, 2);
    await expect(accessControlled.someFunction({from: owner2})).to.be.rejectedWith(EvmError);
  });
})

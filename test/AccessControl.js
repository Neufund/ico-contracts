import { expect } from "chai";
import EvmError from "./helpers/EVMThrow";
import { eventValue } from "./helpers/events";
import { TriState, EVERYONE, GLOBAL } from "./helpers/triState";
import createAccessPolicy from "./helpers/createAccessPolicy";
import roles from "./helpers/roles";

const RoleBasedAccessPolicy = artifacts.require("RoleBasedAccessPolicy");
const TestAccessControl = artifacts.require("TestAccessControl");

contract(
  "AccessControl",
  ([accessController, owner1, owner2, newAccessController, ...accounts]) => {
    let accessPolicy;
    let accessControlled;
    let exampleRole;

    beforeEach(async () => {
      accessPolicy = await createAccessPolicy();
      accessControlled = await TestAccessControl.new(accessPolicy.address);
      exampleRole = roles.example;
    });

    function expectAccessChangedEvent(
      tx,
      subject,
      role,
      object,
      oldValue,
      newValue
    ) {
      const event = eventValue(tx, "LogAccessChanged");
      expect(event).to.exist;
      expect(event.args.controller).to.equal(accessController);
      expect(event.args.subject).to.equal(subject);
      expect(event.args.role).to.equal(role);
      expect(event.args.object).to.equal(object);
      expect(event.args.oldValue).to.be.bignumber.equal(oldValue);
      expect(event.args.newValue).to.be.bignumber.equal(newValue);
    }

    function expectAccessEvent(tx, subject, role, object, granted) {
      const event = eventValue(tx, "LogAccess");
      expect(event).to.exist;
      expect(event.args.subject).to.equal(subject);
      expect(event.args.role).to.equal(role);
      expect(event.args.object).to.equal(object);
      expect(event.args.granted).to.equal(granted);
    }

    function expectAccessPolicyChangedEvent(
      tx,
      controller,
      oldPolicy,
      newPolicy
    ) {
      const event = eventValue(tx, "LogAccessPolicyChanged");
      expect(event).to.exist;
      expect(event.args.controller).to.eq(controller);
      expect(event.args.oldPolicy).to.eq(oldPolicy);
      expect(event.args.newPolicy).to.eq(newPolicy);
    }

    async function subjectIsListed(object, role, subject) {
      const subjects = await accessPolicy.getUsers(object, role);
      expect(subject).oneOf(subjects);
    }

    async function subjectIsNotListed(object, role, subject) {
      const subjects = await accessPolicy.getUsers(object, role);
      expect(subject).not.oneOf(subjects);
    }

    it("should allow owner1", async () => {
      let tx = await accessPolicy.setUserRole(
        owner1,
        exampleRole,
        accessControlled.address,
        TriState.Allow
      );
      expectAccessChangedEvent(
        tx,
        owner1,
        exampleRole,
        accessControlled.address,
        TriState.Unset,
        TriState.Allow
      );
      tx = await accessControlled.someFunction({ from: owner1 });
      expectAccessEvent(
        tx,
        owner1,
        exampleRole,
        accessControlled.address,
        true
      );
      await subjectIsListed(accessControlled.address, exampleRole, owner1);
      const accessValue = await accessPolicy.getValue.call(
        owner1,
        exampleRole,
        accessControlled.address
      );
      expect(accessValue).to.be.bignumber.eq(TriState.Allow);
    });

    it("should disallow owner2", async () => {
      const tx = await accessPolicy.setUserRole(
        owner1,
        exampleRole,
        accessControlled.address,
        TriState.Allow
      );
      expectAccessChangedEvent(
        tx,
        owner1,
        exampleRole,
        accessControlled.address,
        TriState.Unset,
        TriState.Allow
      );
      await expect(
        accessControlled.someFunction({ from: owner2 })
      ).to.be.rejectedWith(EvmError);
    });

    it("should explicitly disallow owner2", async () => {
      const tx = await accessPolicy.setUserRole(
        owner2,
        exampleRole,
        accessControlled.address,
        TriState.Deny
      );
      expectAccessChangedEvent(
        tx,
        owner2,
        exampleRole,
        accessControlled.address,
        TriState.Unset,
        TriState.Deny
      );
      await subjectIsListed(accessControlled.address, exampleRole, owner2);
      const accessValue = await accessPolicy.getValue.call(
        owner2,
        exampleRole,
        accessControlled.address
      );
      expect(accessValue).to.be.bignumber.eq(TriState.Deny);
      await expect(
        accessControlled.someFunction({ from: owner2 })
      ).to.be.rejectedWith(EvmError);
    });

    async function expectRepeatPermissionDoesNothing(state) {
      await accessPolicy.setUserRole(
        owner2,
        exampleRole,
        accessControlled.address,
        state
      );
      const tx = await accessPolicy.setUserRole(
        owner2,
        exampleRole,
        accessControlled.address,
        state
      );
      const event = tx.logs.filter(e => e.event === "LogAccessChanged");
      expect(event).to.be.empty;
    }

    it("should no nothing if permission unchanged", async () => {
      await expectRepeatPermissionDoesNothing(TriState.Allow);
      await expectRepeatPermissionDoesNothing(TriState.Deny);
      await expectRepeatPermissionDoesNothing(TriState.Unset);
    });

    it("should disallow on unset cascade", async () => {
      // for the most specific permission set, the less specific cascade levels should all disallow
      await accessPolicy.setUserRole(
        owner2,
        exampleRole,
        accessControlled.address,
        TriState.Allow
      );
      const disallowOnAllUnset = await accessPolicy.allowed.call(
        "0x0",
        "",
        "0x0",
        ""
      );
      expect(disallowOnAllUnset).to.be.false;
      const disallowOnSubjectSet = await accessPolicy.allowed.call(
        owner2,
        "",
        "0x0",
        ""
      );
      expect(disallowOnSubjectSet).to.be.false;
      const disallowOnRoleSet = await accessPolicy.allowed.call(
        owner2,
        exampleRole,
        "0x0",
        ""
      );
      expect(disallowOnRoleSet).to.be.false;
      const allowAllSet = await accessPolicy.allowed.call(
        owner2,
        exampleRole,
        accessControlled.address,
        ""
      );
      expect(allowAllSet).to.be.true;
    });

    it("should change policy on contract", async () => {
      // simulates replacing access policy on contract
      await accessPolicy.setUserRole(
        owner1,
        exampleRole,
        accessControlled.address,
        TriState.Allow
      );
      const newAccessPolicy = await RoleBasedAccessPolicy.new({
        from: newAccessController
      });
      await newAccessPolicy.setUserRole(
        owner2,
        exampleRole,
        accessControlled.address,
        TriState.Allow,
        { from: newAccessController }
      );
      const newControllerAllowed = await newAccessPolicy.allowed.call(
        newAccessController,
        roles.accessController,
        accessControlled.address,
        ""
      );
      expect(newControllerAllowed).to.be.true;
      const oldControllerAllowed = await accessPolicy.allowed.call(
        accessController,
        roles.accessController,
        accessControlled.address,
        ""
      );
      expect(oldControllerAllowed).to.be.true;
      const oldAccessPolicy = await accessControlled.accessPolicy.call();
      expect(oldAccessPolicy).to.eq(accessPolicy.address);
      const changeTx = await accessControlled.setAccessPolicy(
        newAccessPolicy.address,
        newAccessController
      );
      expectAccessPolicyChangedEvent(
        changeTx,
        accessController,
        accessPolicy.address,
        newAccessPolicy.address
      );
      // should allow owner2 (new policy)
      await accessControlled.someFunction({ from: owner2 });
      // should disallow owner1 (old policy)
      await expect(
        accessControlled.someFunction({ from: owner1 })
      ).to.be.rejectedWith(EvmError);
      // swap back old controller
      const changeBackTx = await accessControlled.setAccessPolicy(
        accessPolicy.address,
        accessController,
        { from: newAccessController }
      );
      expectAccessPolicyChangedEvent(
        changeBackTx,
        newAccessController,
        newAccessPolicy.address,
        accessPolicy.address
      );
      await accessControlled.someFunction({ from: owner1 });
      await expect(
        accessControlled.someFunction({ from: owner2 })
      ).to.be.rejectedWith(EvmError);
    });

    it("should transfer access controller on contract to new account", async () => {
      // add new access controller
      await accessPolicy.setUserRole(
        newAccessController,
        roles.accessController,
        accessControlled.address,
        TriState.Allow
      );
      // deny old access controller (yourself)
      await accessPolicy.setUserRole(
        accessController,
        roles.accessController,
        accessControlled.address,
        TriState.Deny
      );
      // old does not control anymore
      await expect(
        accessControlled.setAccessPolicy(
          accessPolicy.address,
          accessController,
          { from: accessController }
        )
      ).to.be.rejectedWith(EvmError);
      // new access controller controls policy on contract
      await accessControlled.setAccessPolicy(
        accessPolicy.address,
        newAccessController,
        { from: newAccessController }
      );
      // however new access controller does not control permissions on policy
      await expect(
        accessPolicy.setUserRole(
          owner1,
          exampleRole,
          accessControlled.address,
          TriState.Deny,
          { from: newAccessController }
        )
      ).to.be.rejectedWith(EvmError);
      // allow cascade to global
      await accessPolicy.setUserRole(
        accessController,
        roles.accessController,
        accessControlled.address,
        TriState.Unset
      );
      // old access controller may set policy on contract again
      await accessControlled.setAccessPolicy(
        accessPolicy.address,
        accessController,
        { from: accessController }
      );
    });

    it("subject EVERYONE should give access to any msg.sender", async () => {
      await accessPolicy.setUserRole(
        EVERYONE,
        exampleRole,
        accessControlled.address,
        TriState.Allow
      );
      await accessControlled.someFunction({ from: owner1 });
      await accessControlled.someFunction({ from: owner2 });
      await accessControlled.someFunction({ from: newAccessController });
      // no access to other contracts however
      const anotherAccessControlled = await TestAccessControl.new(
        accessPolicy.address
      );
      await expect(
        anotherAccessControlled.someFunction({ from: owner1 })
      ).to.be.rejectedWith(EvmError);
    });

    it("object GLOBAL should give access to all contracts", async () => {
      const anotherAccessControlled = await TestAccessControl.new(
        accessPolicy.address
      );
      await accessPolicy.setUserRole(
        owner1,
        exampleRole,
        GLOBAL,
        TriState.Allow
      );
      await accessControlled.someFunction({ from: owner1 });
      await anotherAccessControlled.someFunction({ from: owner1 });
      // no access for other subjects however
      await expect(
        accessControlled.someFunction({ from: newAccessController })
      ).to.be.rejectedWith(EvmError);
    });

    it("subject EVERYONE adn object GLOBAL should give access to any msg.sender for any contract", async () => {
      const anotherAccessControlled = await TestAccessControl.new(
        accessPolicy.address
      );
      await accessPolicy.setUserRole(
        EVERYONE,
        exampleRole,
        GLOBAL,
        TriState.Allow
      );
      await accessControlled.someFunction({ from: owner1 });
      await accessControlled.someFunction({ from: owner2 });
      await anotherAccessControlled.someFunction({ from: owner1 });
      await anotherAccessControlled.someFunction({ from: owner2 });
    });

    it("should reject access on different role", async () => {
      await accessPolicy.setUserRole(
        owner1,
        roles.whitelistAdmin,
        accessControlled.address,
        TriState.Allow
      );
      await expect(
        accessControlled.someFunction({ from: owner1 })
      ).to.be.rejectedWith(EvmError);
    });

    async function triggerCascade(subject, object, rootSubject, rootObject) {
      await accessPolicy.setUserRole(
        subject,
        exampleRole,
        object,
        TriState.Allow
      );
      const allowed = await accessPolicy.allowed.call(
        rootSubject,
        exampleRole,
        rootObject,
        ""
      );
      expect(allowed).to.be.true;
      await subjectIsListed(object, exampleRole, subject);
      await accessPolicy.setUserRole(
        subject,
        exampleRole,
        object,
        TriState.Unset
      );
      await subjectIsNotListed(object, exampleRole, subject);
    }

    it("should allow access cascading up", async () => {
      // all step in cascade unset
      const allowed = await accessPolicy.allowed.call(
        owner1,
        exampleRole,
        accessControlled.address,
        ""
      );
      expect(allowed).to.be.false;
      // set everyone global
      await triggerCascade(EVERYONE, GLOBAL, owner1, accessControlled.address);
      // set everyone local
      await triggerCascade(
        EVERYONE,
        accessControlled.address,
        owner1,
        accessControlled.address
      );
      // set owner global
      await triggerCascade(owner1, GLOBAL, owner1, accessControlled.address);
      // set owner local
      await triggerCascade(
        owner1,
        accessControlled.address,
        owner1,
        accessControlled.address
      );
    });

    it("should deny when at the bottom of cascade if all allowed", async () => {
      // set full cascade to allowed
      await accessPolicy.set([
        {
          subject: EVERYONE,
          object: GLOBAL,
          role: exampleRole,
          state: TriState.Allow
        },
        {
          subject: EVERYONE,
          object: accessControlled.address,
          role: exampleRole,
          state: TriState.Allow
        },
        {
          subject: owner1,
          object: GLOBAL,
          role: exampleRole,
          state: TriState.Allow
        },
        {
          subject: owner1,
          object: accessControlled.address,
          role: exampleRole,
          state: TriState.Allow
        }
      ]);
      let allowed = await accessPolicy.allowed.call(
        owner1,
        exampleRole,
        accessControlled.address,
        ""
      );
      expect(allowed).to.be.true;
      // now deny step by step
      await accessPolicy.setUserRole(
        EVERYONE,
        exampleRole,
        GLOBAL,
        TriState.Deny
      );
      allowed = await accessPolicy.allowed.call(
        owner1,
        exampleRole,
        accessControlled.address,
        ""
      );
      expect(allowed).to.be.true;

      await accessPolicy.setUserRole(
        EVERYONE,
        exampleRole,
        accessControlled.address,
        TriState.Deny
      );
      allowed = await accessPolicy.allowed.call(
        owner1,
        exampleRole,
        accessControlled.address,
        ""
      );
      expect(allowed).to.be.true;

      await accessPolicy.setUserRole(
        owner1,
        exampleRole,
        GLOBAL,
        TriState.Deny
      );
      allowed = await accessPolicy.allowed.call(
        owner1,
        exampleRole,
        accessControlled.address,
        ""
      );
      expect(allowed).to.be.true;

      await accessPolicy.setUserRole(
        owner1,
        exampleRole,
        accessControlled.address,
        TriState.Deny
      );
      allowed = await accessPolicy.allowed.call(
        owner1,
        exampleRole,
        accessControlled.address,
        ""
      );
      expect(allowed).to.be.false;
    });

    it("should allow when at the bottom of cascade if all denied", async () => {
      // set full cascade to allowed
      await accessPolicy.set([
        {
          subject: EVERYONE,
          object: GLOBAL,
          role: exampleRole,
          state: TriState.Deny
        },
        {
          subject: EVERYONE,
          object: accessControlled.address,
          role: exampleRole,
          state: TriState.Deny
        },
        {
          subject: owner1,
          object: GLOBAL,
          role: exampleRole,
          state: TriState.Deny
        },
        {
          subject: owner1,
          object: accessControlled.address,
          role: exampleRole,
          state: TriState.Deny
        }
      ]);
      let allowed = await accessPolicy.allowed.call(
        owner1,
        exampleRole,
        accessControlled.address,
        ""
      );
      expect(allowed).to.be.false;
      // now deny step by step
      await accessPolicy.setUserRole(
        EVERYONE,
        exampleRole,
        GLOBAL,
        TriState.Allow
      );
      allowed = await accessPolicy.allowed.call(
        owner1,
        exampleRole,
        accessControlled.address,
        ""
      );
      expect(allowed).to.be.false;

      await accessPolicy.setUserRole(
        EVERYONE,
        exampleRole,
        accessControlled.address,
        TriState.Allow
      );
      allowed = await accessPolicy.allowed.call(
        owner1,
        exampleRole,
        accessControlled.address,
        ""
      );
      expect(allowed).to.be.false;

      await accessPolicy.setUserRole(
        owner1,
        exampleRole,
        GLOBAL,
        TriState.Allow
      );
      allowed = await accessPolicy.allowed.call(
        owner1,
        exampleRole,
        accessControlled.address,
        ""
      );
      expect(allowed).to.be.false;

      await accessPolicy.setUserRole(
        owner1,
        exampleRole,
        accessControlled.address,
        TriState.Allow
      );
      allowed = await accessPolicy.allowed.call(
        owner1,
        exampleRole,
        accessControlled.address,
        ""
      );
      expect(allowed).to.be.true;
    });

    describe("enumerating subjects", () => {
      beforeEach(async () => {
        await accessPolicy.set(
          accounts.map(a => ({ subject: a, role: exampleRole }))
        );
        await accessPolicy.set(
          accounts.map(a => ({ subject: a, role: roles.whitelistAdmin }))
        );
      });

      it("should enumerate default ACCESS_CONTROL permissions", async () => {
        const globSubs = await accessPolicy.getUsers(
          GLOBAL,
          roles.accessController
        );
        expect(globSubs).to.have.same.members([accessController]);
        const locSubs = await accessPolicy.getUsers(
          accessPolicy.address,
          roles.accessController
        );
        expect(locSubs).to.have.same.members([accessController]);
      });

      it("should enumerate all subjects", async () => {
        const subjects = await accessPolicy.getUsers(GLOBAL, exampleRole);
        expect(subjects).to.have.same.members(accounts);
      });

      it("should remove last enumerated subject", async () => {
        const subjects = await accessPolicy.getUsers(GLOBAL, exampleRole);
        const accountsCopy = accounts.slice();
        const deletedAccount = subjects.pop();
        expect(accountsCopy.pop()).to.eq(deletedAccount);
        await accessPolicy.setUserRole(
          deletedAccount,
          exampleRole,
          GLOBAL,
          TriState.Unset
        );
        expect(subjects).to.have.same.members(accountsCopy);
      });

      it("should remove second enumerated subject", async () => {
        const subjects = await accessPolicy.getUsers(GLOBAL, exampleRole);
        const accountsCopy = accounts.slice();
        const deletedAccount = subjects.splice(1, 1);
        expect(accountsCopy.splice(1, 1)[0]).to.eq(deletedAccount[0]);
        await accessPolicy.setUserRole(
          deletedAccount[0],
          exampleRole,
          GLOBAL,
          TriState.Unset
        );
        expect(subjects).to.have.same.members(accountsCopy);
      });

      it("should not add duplicate when setting permission again", async () => {
        const subjects = await accessPolicy.getUsers(GLOBAL, exampleRole);
        await accessPolicy.setUserRole(
          accounts[0],
          exampleRole,
          GLOBAL,
          TriState.Deny
        );
        expect(subjects.length).eq(accounts.length);
        expect(subjects).to.have.same.members(accounts);
      });

      it("should add again after Unset", async () => {
        const subjects = await accessPolicy.getUsers(GLOBAL, exampleRole);
        // delete from enumeration
        await accessPolicy.setUserRole(
          subjects[0],
          exampleRole,
          GLOBAL,
          TriState.Unset
        );
        // add again
        await accessPolicy.setUserRole(
          subjects[0],
          exampleRole,
          GLOBAL,
          TriState.Deny
        );
        expect(subjects).to.have.same.members(accounts);
      });
    });

    describe("self policing", () => {
      it("should reject changing policy on policy", async () => {
        await expect(
          accessPolicy.setAccessPolicy(accessPolicy.address, accessController, {
            from: accessController
          })
        ).to.be.rejectedWith(EvmError);
      });

      it("should reject changing permissions from invalid account", async () => {
        await accessPolicy.setUserRole(
          owner1,
          exampleRole,
          accessControlled.address,
          TriState.Allow,
          { from: accessController }
        );
        await expect(
          accessPolicy.setUserRole(
            owner1,
            exampleRole,
            accessControlled.address,
            TriState.Allow,
            { from: newAccessController }
          )
        ).to.be.rejectedWith(EvmError);

        await accessPolicy.setUserRoles(
          [owner1],
          [exampleRole],
          [GLOBAL],
          [TriState.Allow],
          { from: accessController }
        );
        await expect(
          accessPolicy.setUserRole(
            [owner1],
            [exampleRole],
            [GLOBAL],
            [TriState.Allow],
            { from: newAccessController }
          )
        ).to.be.rejectedWith(EvmError);
      });

      it("should reject removing ROLE_ACCESS_CONTROLLER from itself", async () => {
        await expect(
          accessPolicy.setUserRole(
            accessController,
            roles.accessController,
            accessPolicy.address,
            TriState.Deny
          )
        ).to.be.rejectedWith(EvmError);
        await expect(
          accessPolicy.setUserRole(
            accessController,
            roles.accessController,
            accessPolicy.address,
            TriState.Unset
          )
        ).to.be.rejectedWith(EvmError);
      });

      it("should remove ROLE_ACCESS_CONTROLLER for GLOBAL", async () => {
        await accessPolicy.setUserRole(
          accessController,
          roles.accessController,
          GLOBAL,
          TriState.Deny
        );
        await accessPolicy.setUserRole(
          accessController,
          roles.accessController,
          GLOBAL,
          TriState.Unset
        );
        // still functional
        await accessPolicy.setUserRole(
          owner1,
          exampleRole,
          accessControlled.address,
          TriState.Allow,
          { from: accessController }
        );
      });

      it("should transfer access controller on policy to new account", async () => {
        // after deployment use case, see also migrations/6_relinquish_control.js
        await accessPolicy.setUserRole(
          newAccessController,
          roles.accessController,
          GLOBAL,
          TriState.Allow
        );
        await accessPolicy.setUserRole(
          newAccessController,
          roles.accessController,
          accessPolicy.address,
          TriState.Allow
        );
        // removing global permission of itself is allowed
        await accessPolicy.setUserRole(
          accessController,
          roles.accessController,
          GLOBAL,
          TriState.Unset
        );
        // new access controller drops permissions to old one
        await accessPolicy.setUserRole(
          accessController,
          roles.accessController,
          accessPolicy.address,
          TriState.Unset,
          { from: newAccessController }
        );
        await accessPolicy.setUserRole(
          owner1,
          exampleRole,
          accessControlled.address,
          TriState.Allow,
          { from: newAccessController }
        );
        await expect(
          accessPolicy.setUserRole(
            owner1,
            exampleRole,
            accessControlled.address,
            TriState.Allow,
            { from: accessController }
          )
        ).to.be.rejectedWith(EvmError);
      });
    });
  }
);

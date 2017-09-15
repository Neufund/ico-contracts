import { TriState, EVERYONE, GLOBAL } from "./triState";

const RoleBasedAccessControl = artifacts.require(
  "./AccessControl/RoleBasedAccessControl.sol"
);

export default async initialRules => {
  const rbac = await RoleBasedAccessControl.new();
  rbac.set = async rules => {
    if (!rules || rules.length === 0) {
      return;
    }
    const completedRules = rules.map(rule =>
      Object.assign(
        { subject: EVERYONE, object: GLOBAL, state: TriState.Allow },
        rule
      )
    );
    await rbac.setUserRoles(
      completedRules.map(({ subject }) => subject),
      completedRules.map(({ role }) => role),
      completedRules.map(({ object }) => object),
      completedRules.map(({ state }) => state)
    );
  };
  await rbac.set(initialRules);
  return rbac;
};

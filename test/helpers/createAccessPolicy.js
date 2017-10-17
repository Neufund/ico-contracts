import { TriState, EVERYONE, GLOBAL } from "./triState";

const RoleBasedAccessPolicy = artifacts.require("RoleBasedAccessPolicy");

export default async initialRules => {
  const rbap = await RoleBasedAccessPolicy.new();
  rbap.set = async rules => {
    if (!rules || rules.length === 0) {
      return;
    }
    const completedRules = rules.map(rule =>
      Object.assign(
        { subject: EVERYONE, object: GLOBAL, state: TriState.Allow },
        rule
      )
    );
    await rbap.setUserRoles(
      completedRules.map(({ subject }) => subject),
      completedRules.map(({ role }) => role),
      completedRules.map(({ object }) => object),
      completedRules.map(({ state }) => state)
    );
  };
  await rbap.set(initialRules);
  return rbap;
};

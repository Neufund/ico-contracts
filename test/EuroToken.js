import { prettyPrintGasCost } from "./helpers/gasUtils";
import createAccessPolicy from "./helpers/createAccessPolicy";
import { saveBlockchain, restoreBlockchain } from "./helpers/evmCommands";

const EuroToken = artifacts.require("./EuroToken.sol");

contract("EuroToken", () => {
  let snapshot;
  let rbac;
  let euroToken;

  before(async () => {
    rbac = await createAccessPolicy([]);
    euroToken = await EuroToken.new(rbac.address);
    snapshot = await saveBlockchain();
  });

  beforeEach(async () => {
    await restoreBlockchain(snapshot);
    snapshot = await saveBlockchain();
  });

  it("should deploy", async () => {
    await prettyPrintGasCost("EuroToken deploy", euroToken);
  });
});

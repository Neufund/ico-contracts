import { etherToWei, DIGITS } from "./unitConverter";
import { eventValue } from "./events";

const LockedAccount = artifacts.require("LockedAccount");
const EtherToken = artifacts.require("EtherToken");
const NeumarkController = artifacts.require("NeumarkController");
const Neumark = artifacts.require("Neumark");
const Curve = artifacts.require("Curve");

async function deployCurve() {
  const etherToken = await EtherToken.new();
  const neumark = await Neumark.new();
  const neumarkController = await NeumarkController.new(neumark.address);
  await neumark.changeController(neumarkController.address);
  const curve = await Curve.new(neumarkController.address);

  return curve;
}

export async function deployMutableCurve() {
  const curve = await deployCurve();

  return {
    issueInEth: async ether => {
      const euro = ethToEur(ether);
      const tx = await curve.issue(euro);
      return eventValue(tx, "NeumarksIssued", "neumarks");
    }
  };
}

let curve;

export async function curveInEur(moneyInEurULP) {
  if (!curve) {
    curve = await deployCurve();
  }

  return curve.curve(moneyInEurULP);
}

export async function curveInEther(money, eurEtherRatio) {
  if (!curve) {
    curve = await deployCurve();
  }

  const moneyInEurULP = ethToEur(money, eurEtherRatio);

  return curve.curve(moneyInEurULP);
}

export function ethToEur(ether, eurEtherRatio = etherToWei(218.1192809)) {
  return ether.mul(eurEtherRatio).div(DIGITS);
}

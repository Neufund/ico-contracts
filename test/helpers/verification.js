import { etherToWei, DIGITS } from "./unitConverter";
import { eventValue } from "./events";

const LockedAccount = artifacts.require("LockedAccount");
const EtherToken = artifacts.require("EtherToken");
const Neumark = artifacts.require("Neumark");

async function deployNeumark() {
  const etherToken = await EtherToken.new();
  const neumark = await Neumark.new();

  return neumark;
}

export async function deployMutableCurve() {
  const neumark = await deployNeumark();

  return {
    issueInEth: async ether => {
      const euro = ethToEur(ether);
      const tx = await neumark.issueForEuro(euro);
      return eventValue(tx, "NeumarksIssued", "neumarkUlp");
    }
  };
}

let neumark;

export async function curveInEur(moneyInEurULP) {
  if (!neumark) {
    neumark = await deployNeumark();
  }

  return neumark.cumulative(moneyInEurULP);
}

export async function curveInEther(money, eurEtherRatio) {
  if (!neumark) {
    neumark = await deployNeumark();
  }

  const moneyInEurULP = ethToEur(money, eurEtherRatio);

  return neumark.cumulative(moneyInEurULP);
}

export function ethToEur(ether, eurEtherRatio = etherToWei(218.1192809)) {
  return ether.mul(eurEtherRatio).div(DIGITS);
}

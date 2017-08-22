import { etherToWei, DIGITS } from "./unitConverter";

const LockedAccount = artifacts.require("LockedAccount");
const EtherToken = artifacts.require("EtherToken");
const NeumarkController = artifacts.require("NeumarkController");
const NeumarkFactory = artifacts.require("NeumarkFactory");
const Neumark = artifacts.require("Neumark");
const Curve = artifacts.require("Curve");

export async function deployCurve() {
  const etherToken = await EtherToken.new();
  const neumarkFactory = await NeumarkFactory.new();
  const neumark = await Neumark.new(neumarkFactory.address);
  const neumarkController = await NeumarkController.new(neumark.address);
  await neumark.changeController(neumarkController.address);
  const curve = await Curve.new(neumarkController.address);

  return curve;
}

let curve;

export async function curveInEur(moneyInEur) {
  if (!curve) {
    curve = await deployCurve();
  }

  return curve.curve(moneyInEur);
}

export async function curveInEther(money, eurEtherRatio) {
  if (!curve) {
    curve = await deployCurve();
  }

  const moneyInEur = ethToEur(money, eurEtherRatio);

  return curve.curve(moneyInEur);
}

export function ethToEur(ether, eurEtherRatio = etherToWei(218.1192809)) {
  return ether.mul(eurEtherRatio).div(DIGITS);
}

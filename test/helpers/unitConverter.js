const BigNumber = web3.BigNumber;

export const DIGITS = etherToWei(1);

export function etherToWei(number) {
  return new BigNumber(web3.toWei(number, "ether"));
}

export function shanToWei(number) {
  return new BigNumber(web3.toWei(number, "shannon"));
}

export function ethToEur(ether, eurEtherRatio = etherToWei(218.1192809)) {
  return ether.mul(eurEtherRatio).div(DIGITS).round(0, 4);
}

export function eurUlpToEth(eur, eurEtherRatio = 218.1192809) {
  return eur.div(eurEtherRatio).round(0, 4);
}

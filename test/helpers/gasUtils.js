export const weiPrice = 300e-18; // http://coincap.io/
export const gasPrice = 21e9 * weiPrice; // https://ethstats.net
export const gasLimit = 6712392; // https://ethstats.net

const gasCostString = gas =>
  `${gas} gas (€${Math.round(100 * gas * gasPrice) / 100}, ${Math.round(
    1000 * gas / gasLimit
  ) / 10}% of limit)`;

const txGasCost = tx => tx.receipt.gasUsed;

const contractGasCost = contract =>
  web3.eth.getTransactionReceipt(contract.transactionHash).gasUsed;

export const gasCost = obj => {
  if (Number.isInteger(obj)) {
    return obj;
  }

  return obj.receipt ? txGasCost(obj) : contractGasCost(obj);
};

export const prettyPrintGasCost = (what, obj) => {
  const gas = gasCost(obj);

  // eslint-disable-next-line no-console
  console.log(`${what} took ${gasCostString(gas)}`);
};

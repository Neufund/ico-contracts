export const weiPrice = 300e-18; // http://coincap.io/
export const gasPrice = 21e9 * weiPrice; // https://ethstats.net
export const gasLimit = 6712392; // https://ethstats.net

const gasCostString = gas =>
  `${gas} gas (€${Math.round(100 * gas * gasPrice) / 100}, ${Math.round(
    1000 * gas / gasLimit
  ) / 10}% of limit)`;

export const txGasCost = tx => tx.receipt.gasUsed;

export const promisify = func => async (...args) =>
  new Promise((accept, reject) =>
    func(...args, (error, result) => (error ? reject(error) : accept(result)))
  );

export const gasCost = async obj => {
  if (Number.isInteger(obj)) {
    return obj;
  }
  if (obj.receipt) {
    return obj.receipt.gasUsed;
  }

  const receipt = await promisify(web3.eth.getTransactionReceipt)(
    obj.transactionHash
  );
  return receipt.gasUsed;
};

export const prettyPrintGasCost = async (what, obj) => {
  const gas = await gasCost(obj);

  // eslint-disable-next-line no-console
  console.log(`\t${what} took ${gasCostString(gas)}`);
};

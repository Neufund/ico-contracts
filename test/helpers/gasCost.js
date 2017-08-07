export const weiPrice = 222e-18; // http://coincap.io/
export const gasPrice = 21e9 * weiPrice; // https://ethstats.net
export const gasLimit = 6712355; // https://ethstats.net

export default result =>
  `${result.receipt.gasUsed} gas (€${Math.round(100 * result.receipt.gasUsed * gasPrice) /
    100}, ${Math.round(1000 * result.receipt.gasUsed / gasLimit) / 10}% of limit)`;

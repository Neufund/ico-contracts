import BigNumber from "bignumber.js";

// 2**256 - 1
// 2**128 + 1
// 2**128
// 2**128 - 1
// 1
// 0

const two = new BigNumber(2);

export const extrema = {
  "2²⁵⁶ - 1": two.toPower(256).minus(1),
  "2¹²⁸ + 1": two.toPower(128).plus(1),
  "2¹²⁸": two.toPower(128),
  "2¹²⁸ - 1": two.toPower(128).minus(1),
  1: new BigNumber(1),
  0: new BigNumber(0),
};

export const product = (A, B) =>
  Object.keys(A).reduce(a =>
    Object.keys(B)
      .reduce((o, b) => ({ [`(${a}, ${b})`]: [A[a], B[b]] }))
      .reduce((o, e) => ({ ...o, ...e }), {})
  );

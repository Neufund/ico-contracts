import { expect } from "chai";
import EvmError from "./helpers/EVMThrow";

// const divRound = (v, d) => d.divToInt(2).plus(v).divToInt(d);
const Q18 = new web3.BigNumber(10).pow(18);
const B56 = new web3.BigNumber(2).pow(56);
const B255 = new web3.BigNumber(2).pow(255);
const acceptedPrecissionLoss = -9; // 10^-9
const TestMath = artifacts.require("TestMath");

contract("Math", () => {
  let math;

  beforeEach(async () => {
    math = await TestMath.new();
  });

  it("should reject on divRound overflow", async () => {
    // https://www.wolframalpha.com/input/?i=round(115792089237316195423570985008687907853269984665640564039457584007913129639935+%2F+2)
    const a = new web3.BigNumber(
      "115792089237316195423570985008687907853269984665640564039457584007913129639935"
    );
    const b = new web3.BigNumber("2");
    /* const expected = new web3.BigNumber(
      "57896044618658097711785492504343953926634992332820282019728792003956564819968"
    ); */
    await expect(
      math._divRound(a, b),
      "divRound(2**256-1, 2) should be 2**255"
    ).to.be.rejectedWith(EvmError);
  });

  it("should divRound 2**256-2", async () => {
    const a = new web3.BigNumber(
      "115792089237316195423570985008687907853269984665640564039457584007913129639934"
    );
    const b = new web3.BigNumber("2");
    const expected = new web3.BigNumber(
      "57896044618658097711785492504343953926634992332820282019728792003956564819967"
    );
    const r = await math._divRound(a, b);
    expect(r, "divRound(2**256-2, 2) should be 2**255").to.be.bignumber.eq(
      expected
    );
  });

  it("should divRound", async () => {
    expect(await math._divRound(1871, 11), "round up").to.be.bignumber.eq(170);
    expect(
      await math._divRound(12871, 2),
      "round up from 0.5"
    ).to.be.bignumber.eq(6436);
    expect(await math._divRound(10, 2), "no round").to.be.bignumber.eq(5);
    expect(await math._divRound(81542, 23), "round down").to.be.bignumber.eq(
      3545
    );
  });

  it("should absDiff", async () => {
    expect(await math._absDiff(5, 3)).to.be.bignumber.eq(
      await math._absDiff(3, 5)
    );
    expect(await math._absDiff(5, 3)).to.be.bignumber.eq(2);

    // two's complement
    const a = new web3.BigNumber(2).pow(256).sub(5); // uint(-5)
    const b = new web3.BigNumber(2).pow(256).sub(3); // uint(-3)
    expect(await math._absDiff(a, b)).to.be.bignumber.eq(2);
    expect(await math._absDiff(b, a)).to.be.bignumber.eq(2);
  });

  it("should compute fractions", async () => {
    // fractions are computed on 18 decimal places precision
    const amount = Q18.mul(100);
    const full = Q18; // 100%
    expect(await math._decimalFraction(amount, full)).to.be.bignumber.eq(
      amount
    );

    const prc1 = Q18.div(100); // 1%
    expect(await math._decimalFraction(amount, prc1)).to.be.bignumber.eq(
      amount.div(100)
    );

    // how you lose precision on decimal fractions
    const ethRate = Q18.mul(345.7651);
    const etherAmount = Q18.mul(76182.187189893);
    // below is a result of calculation on decimal digits
    const expectedEur = new web3.BigNumber("26341141571932080000000000");
    const resultEur = await math._decimalFraction(etherAmount, ethRate);
    let diff = expectedEur.sub(resultEur).abs().div(Q18);
    expect(diff.e).to.be.lte(acceptedPrecissionLoss);

    // 1/3
    const oneThirdFactor = Q18.div(3).round(0, 1);
    const resultOneThird = await math._decimalFraction(amount, oneThirdFactor);
    const expectedOneThird = amount.div(3); // this will provide nice long expansion
    diff = resultOneThird.sub(expectedOneThird).abs().div(Q18);
    expect(diff.e).to.be.lte(acceptedPrecissionLoss);

    // do not lose precision on binary expansions
    const bAmountMul = new web3.BigNumber(
      "1110101010111001100110101101110001",
      2
    );
    const bAmount = B56.mul(bAmountMul);
    const bRateMul = new web3.BigNumber("10010111101011111010101", 2);
    const bRate = B56.mul(bRateMul);
    const bResult = await math._decimalFraction(bAmount, bRate);
    // how to get binary decimal from Mathematica directly?
    const bExpectedResult = new web3.BigNumber(
      "1000101100010100100010110001100000000111001001100000001010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
      2
    ).div(new web3.BigNumber("110111100000101101101011001110100111011001", 2));
    expect(bResult).to.be.bignumber.eq(bExpectedResult.round(0, 4));

    // this one will overflow and revert
    await expect(math._decimalFraction(B255, 2)).to.be.rejectedWith(EvmError);
  });

  it("should do proportions", async () => {
    // as decimalFractions are proportions of Q18 we already testes those above
    // do one proportion as an example
    // compute neumarks to be released from lock in proportion to funds spent
    const total = Q18.mul(9398192.88127981);
    const spent = Q18.mul(718921.19818982);
    const lockedNeumark = Q18.mul(39889217377);
    const result = await math._proportion(lockedNeumark, spent, total);
    const expectedResult = new web3.BigNumber("3051352990280604000000000000");
    const diff = result.sub(expectedResult).abs().div(Q18);
    expect(diff.e).to.be.lte(-7);
  });
});

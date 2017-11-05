import { expect } from "chai";
import { prettyPrintGasCost } from "./helpers/gasUtils";
import EvmError from "./helpers/EVMThrow";
import { parseNmkDataset } from "./helpers/dataset";

const CurveGas = artifacts.require("./test/CurveGas.sol");
const BigNumber = web3.BigNumber;

const EUR_DECIMALS = new BigNumber(10).toPower(18);
const NMK_DECIMALS = new BigNumber(10).toPower(18);
const INITIAL_REWARD = NMK_DECIMALS.mul(6.5);
const NEUMARK_CAP = NMK_DECIMALS.mul(1500000000);
const WEI_EPSILON = 2;
const LIMIT_EUR_ULPS = new BigNumber("8300000000000000000000000000");
const LIMIT_EUR = LIMIT_EUR_ULPS.div(EUR_DECIMALS);
const LIMIT_LINEAR_EUR_ULPS = new BigNumber("2100000000000000000000000000");

contract("NeumarkIssuanceCurve", () => {
  let curveGas;
  let expectedCurvePointsAtIntegers;
  let expectedCurvePointsAtRandom;

  beforeEach(async () => {
    curveGas = await CurveGas.new();
    expectedCurvePointsAtIntegers = parseNmkDataset(
      `${__dirname}/data/expectedCurvePointsAtIntegers.csv`
    );
    expectedCurvePointsAtRandom = parseNmkDataset(
      `${__dirname}/data/expectedCurvePointsAtRandom.csv`
    );
  });

  it("should deploy", async () => {
    await prettyPrintGasCost("NeumarkIssuanceCurve deploy", curveGas);
    expect(await curveGas.initialRewardFraction()).to.be.bignumber.eq(
      INITIAL_REWARD
    );
    expect(await curveGas.neumarkCap()).to.be.bignumber.eq(NEUMARK_CAP);
  });

  async function expectCumulativeRange(expectedPoints) {
    const gasChunks = await Promise.all(
      expectedPoints.map(async ([e, n]) => {
        const [neumarkUlps, gas] = await curveGas.cumulativeWithGas.call(
          EUR_DECIMALS.mul(e)
        );
        const neumarks = neumarkUlps.div(NMK_DECIMALS);
        expect(
          n.sub(neumarks).abs(),
          `Curve compute failed for EUR value ${e}`
        ).to.be.bignumber.lt(WEI_EPSILON);
        return gas.toNumber();
      })
    );
    const totalGas = gasChunks.reduce((sum, gas) => sum + gas, 0);

    await prettyPrintGasCost("Total", totalGas);
  }

  it("should compute exactly over the integer range", async () => {
    await expectCumulativeRange(expectedCurvePointsAtIntegers);
  });

  it("should compute exactly over the random range", async () => {
    await expectCumulativeRange(expectedCurvePointsAtRandom);
  });

  async function expectIncrementalRange(expectedPoints) {
    let accumulatedNmkUlps = new BigNumber(0);
    let prevEur = new BigNumber(0);
    for (const [e, n] of expectedPoints) {
      const neumarkUlps = await curveGas.incremental.call(
        EUR_DECIMALS.mul(prevEur),
        EUR_DECIMALS.mul(e.sub(prevEur))
      );
      accumulatedNmkUlps = accumulatedNmkUlps.add(neumarkUlps);
      const neumarks = accumulatedNmkUlps.div(NMK_DECIMALS);
      prevEur = e;
      // console.log(`Curve compute for value ${e} should be ${n} but is ${neumarks}`);
      expect(
        n.sub(neumarks).abs(),
        `Curve compute failed for EUR value ${e}`
      ).to.be.bignumber.lt(WEI_EPSILON);
    }
  }

  it("should compute incrementally over the integer range", async () => {
    await expectIncrementalRange(expectedCurvePointsAtIntegers);
  });

  it("should compute incrementally over the random range", async () => {
    await expectIncrementalRange(expectedCurvePointsAtRandom);
  });

  it("should compute inverse at late point", async () => {
    let [, gas] = await curveGas.incrementalInverseWithGas.call(
      LIMIT_EUR_ULPS,
      NMK_DECIMALS
    );
    await prettyPrintGasCost("At issuance limit", gas.toNumber());

    [, gas] = await curveGas.incrementalInverseWithGas.call(
      LIMIT_LINEAR_EUR_ULPS,
      NMK_DECIMALS
    );
    await prettyPrintGasCost("At linear limit", gas.toNumber());

    [, gas] = await curveGas.incrementalInverseWithGas.call(
      LIMIT_LINEAR_EUR_ULPS.divToInt(2),
      NMK_DECIMALS
    );
    await prettyPrintGasCost("At half of linear limit", gas.toNumber());
    assert(true);
  });

  async function expectIncrementalInverseWalk(expectedPoints) {
    // simulates burn of all Neumarks in Neumark token
    // eslint-disable-next-line no-console
    console.log(`will compute ${expectedPoints.length} inverses. stand by...`);
    let totalEuroUlps = new BigNumber("100000000000").mul(EUR_DECIMALS);
    let totalNmk = NEUMARK_CAP;
    expectedPoints.reverse();
    for (const [e, n] of expectedPoints) {
      const burnNmk = totalNmk.sub(NMK_DECIMALS.mul(n));
      if (burnNmk.gt(0)) {
        // if anything to burn
        const expectedEurDeltaUlps = totalEuroUlps.sub(EUR_DECIMALS.mul(e));
        const actualEurDeltaUlps = await curveGas.incrementalInverse[
          "uint256,uint256"
        ](totalEuroUlps, burnNmk);
        const expectedEurDelta = expectedEurDeltaUlps.div(EUR_DECIMALS);
        const actualEurDelta = actualEurDeltaUlps.div(EUR_DECIMALS);
        const roundingPrecision = e.gte("900000000") ? 4 : 10;

        // console.log(`should burn ${burnNmk.toNumber()} with expected Euro delta ${expectedEurDelta.toNumber()}, got ${actualEurDelta.toNumber()} diff ${expectedEurDelta.sub(actualEurDelta).toNumber()}`);
        expect(
          actualEurDelta.round(roundingPrecision, 4),
          `Invalid inverse at NEU ${n} burning NEU ${burnNmk} at ${e.toNumber()}`
        ).to.be.bignumber.eq(expectedEurDelta.round(roundingPrecision, 4));

        totalNmk = totalNmk.sub(burnNmk);
        totalEuroUlps = totalEuroUlps.sub(actualEurDeltaUlps);

        const totalEuro = totalEuroUlps.div(EUR_DECIMALS);
        expect(totalEuro.round(roundingPrecision, 4)).to.be.bignumber.eq(
          e.round(roundingPrecision, 4)
        );

        // check inverse against curve
        /* const controlCurveNmk = await curveGas.cumulative(totalEuroUlps);
        if (controlCurveNmk.sub(totalNmk).abs().gt(0)) {
          console.log(`control nmk do not equal totalNmk ${controlCurveNmk.sub(totalNmk).toNumber()}`)
        } */
      }
    }
    // must burn all Neumarks
    expect(totalNmk).to.be.bignumber.eq(0);
    // must burn almost all euro
    expect(totalEuroUlps.div(EUR_DECIMALS).round(10, 4)).to.be.bignumber.eq(0);
  }

  it("should burn all neumarks with incremental inverse over integer range", async () => {
    await expectIncrementalInverseWalk(expectedCurvePointsAtIntegers);
  });

  it("should burn all neumarks with incremental inverse over random range", async () => {
    await expectIncrementalInverseWalk(expectedCurvePointsAtRandom);
  });

  async function expectRangeInversed(expectedPoints) {
    // eslint-disable-next-line no-console
    console.log(`will compute ${expectedPoints.length} inverses. stand by...`);
    expectedPoints.reverse();
    for (const [e, n] of expectedPoints.filter(([ef]) => ef.lte(LIMIT_EUR))) {
      const nUlps = NMK_DECIMALS.mul(n);
      const inverseEurUlps = await curveGas.cumulativeInverse(
        nUlps,
        0,
        LIMIT_EUR_ULPS
      );
      const inverseEur = inverseEurUlps.div(EUR_DECIMALS);
      // console.log(`should inverse ${n} expected ${e.toNumber()}, got ${inverseEur.toNumber()}`);
      if (inverseEurUlps.gt(0)) {
        const atInverseNmk = await curveGas.cumulative(inverseEurUlps);
        const belowInverseNmk = await curveGas.cumulative(
          inverseEurUlps.sub(1)
        );
        const aboveInverseNmk = await curveGas.cumulative(
          inverseEurUlps.add(1)
        );
        // below must be less, binary search must returns beginning of range of identical values
        expect(
          belowInverseNmk,
          `Not at lower bound for EUR ${inverseEurUlps}`
        ).to.be.bignumber.lt(atInverseNmk);
        // must be monotonic (actually we allow +-2 difference as binomial expansion is not monotonic for large euro values)
        expect(
          aboveInverseNmk,
          `Not monotonic for EUR ${inverseEurUlps} diff ${aboveInverseNmk
            .sub(atInverseNmk)
            .toNumber()}`
        ).to.be.bignumber.gte(atInverseNmk.sub(2));
      }
      // request precision depending on point on the curce
      const roundingPrecision = e.gte("900000000") ? 4 : 10;
      expect(
        inverseEur.round(roundingPrecision, 4),
        `Invalid inverse for NEU ${n}`
      ).to.be.bignumber.eq(e.round(roundingPrecision, 4));
    }
  }

  it("should compute cumulative inverse over integer range", async () => {
    await expectRangeInversed(expectedCurvePointsAtIntegers);
  });

  it("should compute cumulative inverse over random range", async () => {
    await expectRangeInversed(expectedCurvePointsAtRandom);
  });

  it("should revert on cumulative inverse from not in range", async () => {
    const expectedInverseEurUlps = EUR_DECIMALS.mul(5000000);
    const burnNmkUlps = NMK_DECIMALS.mul(
      new BigNumber("3.21504457765812047556165399769811884e7")
    );
    await curveGas.cumulativeInverse(burnNmkUlps, 0, expectedInverseEurUlps);
    await expect(
      curveGas.cumulativeInverse(burnNmkUlps, 0, expectedInverseEurUlps.sub(1))
    ).to.be.rejectedWith(EvmError);
  });

  it("should compute inverse cheaply when search ranges equal inverse", async () => {
    const expectedInverseEurUlps = EUR_DECIMALS.mul(5000000);
    const burnNmkUlps = NMK_DECIMALS.mul(
      new BigNumber("3.21504457765812047556165399769811884e7")
    );
    const [actualInverseEurUlps, gas] = await curveGas.cumulativeInverseWithGas(
      burnNmkUlps,
      expectedInverseEurUlps,
      expectedInverseEurUlps
    );
    expect(actualInverseEurUlps).to.be.bignumber.eq(expectedInverseEurUlps);
    await prettyPrintGasCost("Inverse gas", gas.toNumber());
  });

  it("should reject to compute inverse cheaply when search ranges not equal inverse", async () => {
    const expectedInverseEurUlps = EUR_DECIMALS.mul(5000000);
    const burnNmkUlps = NMK_DECIMALS.mul(
      new BigNumber("3.21504457765812047556165399769811884e7")
    );
    await expect(
      curveGas.cumulativeInverseWithGas(
        burnNmkUlps,
        expectedInverseEurUlps.sub(1),
        expectedInverseEurUlps.sub(1)
      )
    ).to.be.rejectedWith(EvmError);
  });

  it("should compute incremental inverse cheaply when search ranges equal inverse", async () => {
    // 4000000,2.57759629704150400556252848464617472e7
    // 5000000,3.21504457765812047556165399769811884e7
    const totalEuroUlps = EUR_DECIMALS.mul(5000000);
    const expectedInverseEurDeltaUlps = EUR_DECIMALS.mul(5000000 - 4000000);
    const afterBurnNmk = new BigNumber(
      "2.57759629704150400556252848464617472e7"
    );
    const expectedInverseEurUlps = await curveGas.cumulativeInverse(
      afterBurnNmk.mul(NMK_DECIMALS),
      0,
      totalEuroUlps
    );
    // expect(expectedInverseEurUlps).to.be.bignumber.eq(EUR_DECIMALS.mul(4000000));
    // const controlInverseNmkUlps = await curveGas.cumulative(expectedInverseEurUlps);
    // expect(controlInverseNmkUlps.sub(afterBurnNmk.mul(NMK_DECIMALS).abs())).to.be.bignumber.lt(WEI_EPSILON);
    // NOTE: there is no exact inverse so we must provide search range so at least one inverse value is in it, due to asserts below
    //  NeumarkIssuanceCurve.sol::cumulativeInverse
    //  require(cumulative(minEurUlps) <= neumarkUlps);
    //  require(cumulative(maxEurUlps) >= neumarkUlps);
    await curveGas.cumulativeInverse(
      afterBurnNmk.mul(NMK_DECIMALS),
      expectedInverseEurUlps.sub(1),
      expectedInverseEurUlps
    );
    // calculate incremental nmk burn
    const burnNmk = new BigNumber(
      "3.21504457765812047556165399769811884e7"
    ).sub(afterBurnNmk);
    const burnNmkUlps = NMK_DECIMALS.mul(burnNmk);
    const [
      actualInverseEurDeltaUlps,
      gas
    ] = await curveGas.incrementalInverseWithGas[
      "uint256,uint256,uint256,uint256"
    ](
      totalEuroUlps,
      burnNmkUlps,
      expectedInverseEurUlps.sub(1),
      expectedInverseEurUlps
    );
    expect(
      actualInverseEurDeltaUlps.sub(expectedInverseEurDeltaUlps).abs()
    ).to.be.bignumber.lt(WEI_EPSILON);
    await prettyPrintGasCost("Inverse gas", gas.toNumber());
  });

  it("should approximate non existing inverse by rounding up", async () => {
    // for 1 ulp of Eur we should get ~6.5 ulps of Neumark (but rounded down)
    const neu1EurUlps = await curveGas.cumulative(1);
    // 6.4999999999999999999999999859166667 * 10^-18 but disregard decimals for clarity
    expect(neu1EurUlps).to.be.bignumber.eq(
      new BigNumber("6.4999999999999999999999999859166667").round(0)
    );
    for (let nmkUlps = 1; nmkUlps <= neu1EurUlps.toNumber(); nmkUlps += 1) {
      const approxInv = await curveGas.cumulativeInverse(nmkUlps, 0, 1);
      expect(approxInv).to.be.bignumber.eq(1);
    }
    // for 2 ulps of Eur we should get 12 ulps of Neumark (because rounded down)
    const neu2EurUlps = await curveGas.cumulative(2);
    expect(neu2EurUlps).to.be.bignumber.eq(
      new BigNumber("12.9999999999999999999999999").round(0)
    );
    for (
      let nmkUlps = neu1EurUlps.toNumber() + 1;
      nmkUlps <= neu2EurUlps.toNumber();
      nmkUlps += 1
    ) {
      const approxInv = await curveGas.cumulativeInverse(nmkUlps, 1, 2);
      expect(approxInv).to.be.bignumber.eq(2);
    }
  });

  it("should inverse 1 nmk ulp when on eurUlps max limit", async () => {
    await curveGas.incrementalInverse["uint256,uint256"](LIMIT_EUR_ULPS, 1);
    await curveGas.incrementalInverse["uint256,uint256"](
      LIMIT_LINEAR_EUR_ULPS,
      1
    );
  });

  it("should perform approximate binary search", async () => {
    const maxSearch = 120;

    // simple increasing curve
    function simpleExp(value) {
      return Math.floor(Math.exp(1 + value / (maxSearch / 7)));
    }

    // port of binary search from solidity
    const binSearch = (value, minRange, maxRange) => {
      let iter = 0;
      let min = minRange;
      // max is inclusive
      let max = maxRange + 1;
      while (max > min) {
        // eslint-disable-next-line no-bitwise
        const mid = (max + min) >> 1;
        // this search must return NEXT value for approximate matches
        if (simpleExp(mid) < value) {
          min = mid + 1;
        } else {
          max = mid;
        }
        iter += 1;
      }
      return [min, iter, "app"];
    };

    // output search table
    const neumarks = Array.from(new Array(maxSearch + 1), (x, i) => [
      i,
      simpleExp(i)
    ]);
    // console.log(neumarks);

    let avgIters = 0;
    for (let expVal = 2; expVal < simpleExp(maxSearch) + 1; expVal += 1) {
      const r = binSearch(expVal, 0, maxSearch);
      // use linear search to verify
      let expectedIdx;
      for (expectedIdx = 0; expectedIdx < neumarks.length; expectedIdx += 1) {
        // console.log(expectedIdx, neumarks[expectedIdx], expVal);
        if (neumarks[expectedIdx][1] >= expVal) break;
      }
      // console.log(`idx ${r[0]} -> ${simpleExp(r[0])} == ${expVal} |`, r);
      expect(r[0], `Invalid search for element ${expVal}`).to.eq(expectedIdx);
      avgIters += r[1];
    }
    // eslint-disable-next-line no-console
    console.log(
      `\tAverage searches ${avgIters /
        (simpleExp(maxSearch) - 2)} vs theoretical O(log N) ${Math.log2(
        maxSearch
      )}`
    );
  });

  /* it("test", async() => {
    const inverseEurUlps = (new BigNumber("8.00000000000000000000000000e+26")).sub(1000000); //await curveGas.cumulativeInverse(new BigNumber("1.38858963267849917935768414474503669e9"), 0, LIMIT_EUR_ULPS);
    const atInverseNmk = await curveGas.cumulative(inverseEurUlps);
    const belowInverseNmk = await curveGas.cumulative(inverseEurUlps.sub(1));
    const aboveInverseNmk = await curveGas.cumulative(inverseEurUlps.add(1));
    // below must be less, binary search must returns beginning of range of identical values
    // expect(belowInverseNmk).to.be.bignumber.lt(atInverseNmk);
    // must be monotonic
    // expect(aboveInverseNmk).to.be.bignumber.gte(atInverseNmk);
    // await curveGas.incremental(inverseEurUlps, 1);
    const euroUlps = await curveGas.incrementalInverse(inverseEurUlps.add(3), 1);
    console.log(euroUlps);
    let prevInverseNmk = atInverseNmk;
    for (let addNmk = 1; addNmk < 100001; addNmk += 1) {
      const aboveInverseNmk2 = await curveGas.cumulative(inverseEurUlps.add(addNmk));
      // const diffNmk = nUlps.sub(belowInverseNmk);

      if (aboveInverseNmk2.sub(prevInverseNmk).lte(-2)) {
        console.log(`above ${addNmk} nmk ${aboveInverseNmk2.sub(prevInverseNmk).toNumber()}`);
      }
      prevInverseNmk = aboveInverseNmk2;
    }
  }); */
});

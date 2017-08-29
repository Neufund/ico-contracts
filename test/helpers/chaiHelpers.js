import invariant from "invariant";

export default function(chai) {
  chai.Assertion.addMethod("balanceWith", function balanceWith({
    ether,
    neumarks
  }) {
    invariant(ether, "missing ether parameter");
    invariant(neumarks, "missing neumarks parameter");

    // eslint-disable-next-line no-underscore-dangle
    const balance = this._obj;

    chai
      .expect(balance[0], `Ether balance should be eq to ${ether.toString()}`)
      .to.be.bignumber.eq(ether);
    chai
      .expect(
        balance[1],
        `Nuemarks balance should be eq ${neumarks.toString()}`
      )
      .to.be.bignumber.eq(neumarks);
  });
}

import invariant from "invariant";

export default function(chai, utils) {
  chai.Assertion.addMethod("balanceWith", function({ ether, neumarks }) {
    invariant(ether, "missing ether parameter");
    invariant(neumarks, "missing neumarks parameter");

    var balance = this._obj;

    chai.expect(balance[0], `Ether balance should be eq to ${ether.toString()}`).to.be.bignumber.eq(ether);
    chai.expect(balance[1], `Nuemarks balance should be eq ${neumarks.toString()}`).to.be.bignumber.eq(neumarks);
  });
}

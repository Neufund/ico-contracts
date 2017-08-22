import invariant from "invariant";

export default function(chai, utils) {
  chai.Assertion.addMethod("balanceWith", function({ ether, neumarks }) {
    invariant(ether, "missing ether parameter");
    invariant(neumarks, "missing neumarks parameter");

    var balance = this._obj;

    chai.expect(balance[0]).to.be.bignumber.eq(ether);
    chai.expect(balance[1]).to.be.bignumber.eq(neumarks);
  });
}

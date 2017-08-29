import invariant from "invariant";

export default function(chai) {
  chai.Assertion.addMethod("blockchainArrayOfSize", async function(size) {
    invariant(size >= 0, "Size has to be >= 0");

    // I would love to hear ideas for better implementation

    // eslint-disable-next-line no-underscore-dangle
    const web3ArrayAccessor = this._obj;

    // negative indexes seems to not play nicely with web3 so we skip this case
    if (size != 0) {
      try {
        await web3ArrayAccessor(size - 1);
      } catch (e) {
        this.assert(
          false,
          `expected web3 array to be size of ${size} but it looks like it's smaller` // i think it's impossible to get an array name in this point
        );
      }
    }
  });
}

export default function(chai) {
  chai.Assertion.addMethod(
    "blockchainArrayOfSize",
    async function blockchainArrayOfSize(size) {
      // I would love to hear ideas for better implementation

      const web3ArrayAccessor = this._obj; // eslint-disable-line no-underscore-dangle

      try {
        await web3ArrayAccessor(size - 1);
      } catch (e) {
        this.assert(
          false,
          `expected web3 array to be size of ${size} but it looks like it's smaller` // i think it's impossible to get an array name in this point
        );
      }

      try {
        await web3ArrayAccessor(size);
      } catch (e) {
        return; // if it throws then it's fine and we just finish
      }
      this.assert(
        false,
        `expected web3 array to be size of ${size} but it looks like it's bigger`
      );
    }
  );
}

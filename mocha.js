import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import chaiBignumber from "chai-bignumber";

chai.use(chaiAsPromised).use(chaiBignumber(web3.BigNumber));

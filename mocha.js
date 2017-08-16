import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import chaiBignumber from "chai-bignumber";
import { BigNumber } from "web3";

chai.use(chaiAsPromised).use(chaiBignumber(BigNumber));

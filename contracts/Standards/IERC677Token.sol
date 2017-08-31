pragma solidity 0.4.15;

import './IERC20Token.sol';
import './IERC677Allowance.sol';

contract IERC677Token is IERC20Token, IERC677Allowance {
}

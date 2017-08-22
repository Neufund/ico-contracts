pragma solidity ^0.4.11;

import 'zeppelin-solidity/contracts/token/ERC20.sol';
import '../ApproveAndCallCallback.sol';

contract TestFeeDistributionPool is ApproveAndCallFallBack {

    event TEST_receiveApproval(address from, uint256 amount);
    function receiveApproval(address from, uint256 _amount, address _token, bytes _data)
        public
        returns (bool)
    {
        require(ERC20(_token).transferFrom(from, address(this), _amount));
        TEST_receiveApproval(from, _amount);
        return true;
    }
}

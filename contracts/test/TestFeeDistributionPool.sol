pragma solidity 0.4.15;

import '../Standards/IERC677Callback.sol';
import '../Standards/IERC677Token.sol';

contract TestFeeDistributionPool is IERC677Callback {

    event TEST_receiveApproval(address from, uint256 amount);
    function receiveApproval(address from, uint256 _amount, address _token, bytes _data)
        public
        returns (bool)
    {
        require(IERC677Token(_token).transferFrom(from, address(this), _amount));
        TEST_receiveApproval(from, _amount);
        return true;
    }
}

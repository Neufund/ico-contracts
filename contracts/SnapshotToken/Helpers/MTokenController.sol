pragma solidity 0.4.15;

import './MTokenTransferController.sol';
import './MTokenAllowanceController.sol';


/// @title controls approvals and transfers
/// @dev The token controller contract must implement these functions, see Neumark as example
/// @dev please note that controller may be a separate contract that is called from mOnTransfer and mOnApprove functions
contract MTokenController is MTokenTransferController, MTokenAllowanceController {
}

pragma solidity 0.4.15;

import './MTokenTransferController.sol';
import './MTokenAllowanceController.sol';


/// @dev The token controller contract must implement these functions
contract MTokenController is MTokenTransferController, MTokenAllowanceController {
}

pragma solidity ^0.4.11;

// a proxy tp call contracts with different sender
contract SenderProxy {
  address _t;
  function _target( address target ) {
    _t = target;
  }
 }

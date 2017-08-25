pragma solidity 0.4.15;


import '../Standards/IBasicToken.sol';
import '../Math.sol';


/**
 * @title Basic token
 * @dev Basic version of StandardToken, with no allowances.
 */
contract BasicToken is IBasicToken, Math {

  mapping(address => uint256) balances;

  uint256 public totalSupply;

  /// @dev This function makes it easy to get the total number of tokens
  /// @return The total number of tokens
  function totalSupply()
      public
      constant
      returns (uint256)
  {
      return totalSupply;
  }

  /**
  * @dev transfer token for a specified address
  * @param _to The address to transfer to.
  * @param _value The amount to be transferred.
  */
  function transfer(address _to, uint256 _value) returns (bool) {
    balances[msg.sender] = sub(balances[msg.sender], _value);
    balances[_to] = add(balances[_to], _value);
    Transfer(msg.sender, _to, _value);
    return true;
  }

  /**
  * @dev Gets the balance of the specified address.
  * @param _owner The address to query the the balance of.
  * @return An uint256 representing the amount owned by the passed address.
  */
  function balanceOf(address _owner) constant returns (uint256 balance) {
    return balances[_owner];
  }

}

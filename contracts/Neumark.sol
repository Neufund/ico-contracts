pragma solidity ^0.4.11;

import 'minimetoken/contracts/MiniMeToken.sol';
import './NeumarkFactory.sol';

// NOTE: MiniMeToken inherits Controler, which is like Ownable, except with
//       different names.

// NOTE: This contract gives warning on compiling, should be fixed with
//       https://github.com/Giveth/minime/pull/22

contract Neumark is MiniMeToken {

    string constant TOKEN_NAME     = "Neumark";
    uint8  constant TOKEN_DECIMALS = 18;
    string constant TOKEN_SYMBOL   = "NMK";

    function Neumark(
        NeumarkFactory factory // Generator for cloned tokens  Set to MiniMeTokenFactory instance.
    )
        MiniMeToken(
            factory, // Address cloned token factory
            0x0, // Address of the parent token, set to 0x0 if it is a new token
            0, // Block of the parent token, set to 0 if it is a new token
            TOKEN_NAME,
            TOKEN_DECIMALS,
            TOKEN_SYMBOL,
            false // Do not enable transfers at start
        )
    {
    }
}

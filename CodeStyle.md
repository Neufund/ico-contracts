# Code style

Order within contracts:

1. Type declarations
2. Constants
3. Immutable state variables (Set only in constructor)
3. State variables
4. Events
5. Modifiers
4. Constructor
5. Fallback function
6. External functions (constant functions last)
7. Public funcions (constant functions last)
8. Internal functions (constant functions last)
9. Private functions (constant functions last)

Order of operations within an external or public function:

1. `pure` Validate input (`require`)
2. `constant` Read state, compute and validate more (`require` and `assert`)
3. Write state (from here only `pure` operations allowed) (no `require` or `assert`)
4. Call external functions (`assert` allowed again)
5. Write logs
6. Return

The critical section is between the first read and the last write. In this region the control flow needs to be extremely reliable.

Abstract internal functions are used through a Mixin interface; a constract with an `M` prefix containing only abstract internal functions.

Constants and immutable state variables are ALL_CAPS. Internal constants go before private ones. All constants are either internal or private.

Mutable state variables are _camelCase with a `_` prefix. State variables should always be `private` or, when intended to be access by a subclass, `internal`. This is to avoid uncessary public functions cluthering the ABI, or accidental collision/overriding a state variable in a subclass.

Don't use `uint`, always be explicit and use `uint256`.

Only mutable state variables can start with `_`. In particular functions, arguments and variables do not.

Log events start with `Log`.

# References

* [Solidity official style guide][docs]
* [ConsenSys Best Practices][csbp]

[docs]: https://solidity.readthedocs.io/en/develop/style-guide.html
[csbp]: https://github.com/ConsenSys/smart-contract-best-practices


# TODO

Mark contracts Trusted or Untrusted.

[]: https://github.com/ConsenSys/smart-contract-best-practices#mark-untrusted-contracts

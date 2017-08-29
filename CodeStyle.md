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

1. Validate input (`require`)
2. Read state
3. Process and validate more (`require` and `assert`)
4. Write state
5. Call external functions (even if they are constant)
6. Write logs
7. Return

# References

* [Solidity official style guide][docs]
* [ConsenSys Best Practices][csbp]

[docs]: https://solidity.readthedocs.io/en/develop/style-guide.html
[csbp]: https://github.com/ConsenSys/smart-contract-best-practices

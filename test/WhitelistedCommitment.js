


// it -> check fix cost inv crossing ticket size by 1 wei
// it -> set fixed cost (parametrized test by number of investors)
// it -> set whitelist (parametrized test by number of investors)
// it -> set large whitelist (1000 addresses) and check gas
// it -> commit fixed and verify numbers (alt cases: below ticket, ticket, above ticket, and all of those but with many commits)
// it -> commit whitelisted and verify numbers (case 1: no fixed, case 2: with fixed)
// it -> commit whitelisted then fixed, verify numbers (alt case: vice versa - should not make any impact)


// separate test set for whitelisted -> public commitment
// it -> whitelisted ends ok -> public ends ok (check state of lock and neumark token)

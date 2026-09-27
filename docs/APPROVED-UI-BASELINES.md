# Approved UI Baselines

This file records founder-approved interface checkpoints. An approved checkpoint is immutable by convention: subsequent work continues on the integration branch and must not rewrite the approved branch.

| Surface | Approved branch | Exact SHA |
|---|---|---|
| Front door | `approved/front-door-2026-09-27` | `986c4e2ec1ca42caa8bd3ec46f7efab78d24dec8` |
| Sign in | `approved/sign-in-2026-09-27` | `134e0a09338ddd4160fcd2dd9a79d46a2cd7394e` |
| Create account | `approved/create-account-2026-09-27` | `b469e51286abf73e4f31cb7e0af60ed6b56888bd` |
| Authentication recovery | `approved/authentication-recovery-2026-09-27` | `8aa4576e15aa680db2600cbd95d2c8813660cb79` |
| Home / Arrange Travel | `approved/home-2026-09-27` | `0fa2d12071a2204c05a84e5b81681bfbdf7de382` |
| Hamburger drawer | `approved/drawer-2026-09-27` | `0997d43a86ac390848efd78edc3c1ef8320f254a` |

## Lock protocol

When a surface is approved:

1. Create an `approved/<surface>-<date>` branch at the exact integration SHA.
2. Compare the approved branch with the integration branch and require zero differences at the moment of approval.
3. Verify the Render preview reports that exact SHA as live before calling the deployed interface locked.
4. Record the approved branch and SHA in this file.
5. Continue later work only on the integration branch unless the founder explicitly revises the approved baseline.

A visual change is not considered locked merely because it was committed.

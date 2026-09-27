# Approved UI Baselines

This file records founder-approved interface checkpoints. An approved checkpoint is immutable by convention: subsequent work continues on the integration branch and must not rewrite the approved branch.

| Surface | Approved branch | Exact SHA |
|---|---|---|
| Front door | `approved/front-door-2026-09-27` | `986c4e2ec1ca42caa8bd3ec46f7efab78d24dec8` |
| Sign in | `approved/sign-in-2026-09-27` | `134e0a09338ddd4160fcd2dd9a79d46a2cd7394e` |
| Create account | `approved/create-account-2026-09-27` | `b469e51286abf73e4f31cb7e0af60ed6b56888bd` |
| Authentication recovery | `approved/authentication-recovery-2026-09-27` | `8aa4576e15aa680db2600cbd95d2c8813660cb79` |
| Home / Arrange Travel | `approved/home-2026-09-27` | `0fa2d12071a2204c05a84e5b81681bfbdf7de382` |
| Hamburger drawer | `approved/drawer-2026-09-27` | `f3a7c883e879c8d27af461c40c6691f4204c170b` |
| Profile / Account Details / Saved Places / Cabin Environment / Traveler Safety | `approved/profile-account-safety-2026-09-27` | `362b5f7c21642bf6d17c9c6859aca8efe0bc9569` |
| Sign-in & Security / account identity management | `approved/account-security-2026-09-27` | `6d3bc82c8369a9c01f4045b919b73693710eabd2` |

## Lock protocol

When a surface is approved:

1. Create an `approved/<surface>-<date>` branch at the exact integration SHA.
2. Compare the approved branch with the integration branch and require zero differences at the moment of approval.
3. Verify the Render preview reports that exact SHA as live before calling the deployed interface locked.
4. Record the approved branch and SHA in this file.
5. Continue later work only on the integration branch unless the founder explicitly revises the approved baseline.

A visual change is not considered locked merely because it was committed.

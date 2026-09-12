# Brief: Password reset

## Goal
Users who forgot their password can set a new one via an emailed link, without contacting support.

## Decisions
- D1: A reset link expires 30 minutes after it is issued (example: issued 10:00, used 10:31 -> rejected as expired)
- D2: A reset link can be used only once
- D3: The request page shows the same generic message whether or not the email is registered

## Assumptions
- A1: Existing email service is reused; no new templates beyond the reset email

## Out of scope
- SMS-based reset
- Admin-initiated resets

## Glossary
- **reset link**: a URL containing a single-use token that allows setting a new password
- **registered email**: an email address belonging to an active account

## Open questions
none

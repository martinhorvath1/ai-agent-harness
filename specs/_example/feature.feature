Feature: Password reset
  As a user who forgot my password
  I want to reset it via an emailed reset link
  So that I can regain access without contacting support

  @D1
  Scenario Outline: Reset link expiry
    Given a reset link was issued at "<issued>"
    When the user opens the reset link at "<opened>"
    Then the result is "<result>"

    Examples:
      | issued | opened | result   |
      | 10:00  | 10:29  | accepted |
      | 10:00  | 10:31  | expired  |

  @D2
  Scenario: A reset link cannot be used twice
    Given a user has set a new password using a reset link
    When the user opens the same reset link again
    Then the link is rejected as already used

  @D3
  Scenario Outline: Generic confirmation message
    When a reset is requested for "<email>"
    Then the page shows "If that address is registered, a reset link is on its way."

    Examples:
      | email                  |
      | registered@example.com |
      | unknown@example.com    |

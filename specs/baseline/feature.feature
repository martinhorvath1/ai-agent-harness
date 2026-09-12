Feature: 2048 baseline
  A player runs `pipeline play`, sees the opening board drawn as a frame, presses
  direction keys or a quit key, and leaves. The move seam is in place but empty:
  a direction never changes the board yet.

  Background:
    Given the `pipeline` command is available

  # --- the command surface -------------------------------------------------

  @D2 @D3
  Scenario: the usage text lists play and no longer lists hello
    When the player runs `pipeline --help`
    Then stdout lists the command `play`
    And stdout does not mention `hello`
    And the exit code is 0

  @D3 @D4
  Scenario Outline: an unrecognised command name is reported
    When the player runs `pipeline <name>`
    Then stderr contains `unknown command: <name>`
    And stderr shows the usage text
    And the exit code is 1

    Examples:
      | name  |
      | nope  |
      | hello |

  @D11
  Scenario: play takes no arguments
    When the player runs `pipeline play extra`
    Then stderr contains `usage: play`
    And the exit code is 1

  # --- the opening board and the frame -------------------------------------

  @D12 @D13 @D14
  Scenario: a frame is a title, the grid and a hint
    When the player runs `pipeline play` and immediately presses the quit key `q`
    Then stdout holds exactly one frame
    And the first line of the frame is `2048`
    And the second line of the frame is blank
    And the next lines are a box-drawing grid of 4 rows and 4 cells per row
    And every cell of the grid is 6 characters wide
    And the line after the grid is blank
    And the last line of the frame is `Arrows/WASD to move - q to quit`

  @D5 @D6
  Scenario Outline: the opening board holds exactly two tiles
    Given the seed is <seed>
    When the player runs `pipeline play` and immediately presses the quit key `q`
    Then the board in the frame has 16 cells
    And exactly 2 cells hold a tile
    And every tile is either 2 or 4
    And the other 14 cells are drawn as empty cells

    Examples:
      | seed |
      | 0    |
      | 1    |
      | 7    |
      | 42   |

  @D6
  Scenario: a 4 can appear as an opening tile
    Given the seed is chosen so that the random source yields a value below 0.1 for a tile value
    When the player runs `pipeline play` and immediately presses the quit key `q`
    Then at least one tile on the opening board is 4

  # --- randomness and the seed ---------------------------------------------

  @D7 @D9
  Scenario: a seeded run is reproducible
    Given the seed is 1
    When the player runs `pipeline play` and immediately presses the quit key `q` twice
    Then both runs print byte-identical output
    And the exit code is 0

  @D7 @D9
  Scenario: different seeds are allowed to differ
    When the player runs `pipeline play` once with the seed 1 and once with the seed 2
    Then each run still prints an opening board holding exactly two tiles

  @D8
  Scenario: an unseeded run is random
    Given no seed is set
    When the player runs `pipeline play` 5 times, each time immediately pressing the quit key `q`
    Then the 5 opening boards are not all identical

  @D10
  Scenario Outline: a seed that is not a non-negative integer no greater than 4294967295 is an error
    Given the seed is <seed>
    When the player runs `pipeline play`
    Then stderr mentions the seed `PIPELINE_SEED`
    And the exit code is 1
    And no frame is printed

    Examples: rejected seeds
      | seed       |
      | abc        |
      | 1.5        |
      | -1         |
      |            |
      | 1e3        |
      | 4294967296 |

  @D10
  Scenario: the largest accepted seed is 4294967295
    Given the seed is 4294967295
    When the player runs `pipeline play` and immediately presses the quit key `q`
    Then stdout holds exactly one frame
    And the exit code is 0

  # --- the interactive loop -------------------------------------------------

  @D15
  Scenario: piped output carries no escape codes
    Given stdin is a pipe, not a TTY
    When the player runs `pipeline play` and immediately presses the quit key `q`
    Then stdout contains no ANSI escape codes
    And the exit code is 0

  @D16 @D17
  Scenario Outline: a quit key ends the loop
    When the player runs `pipeline play` and immediately presses the quit key <key>
    Then stdout holds exactly 1 frame
    And the exit code is 0

    Examples:
      | key      |
      | `q`      |
      | `Ctrl-C` |

  @D16 @D17
  Scenario: end of input ends the loop
    Given stdin is closed without any key being pressed
    When the player runs `pipeline play`
    Then stdout holds exactly 1 frame
    And the exit code is 0

  @D1 @D18 @D19 @D20
  Scenario Outline: a direction key redraws the same board
    Given the seed is 1
    When the player runs `pipeline play`, presses <key>, then the quit key `q`
    Then stdout holds exactly 2 frames
    And the two frames are identical
    And the exit code is 0

    Examples: WASD, case-insensitive
      | key |
      | `w` |
      | `a` |
      | `s` |
      | `d` |
      | `W` |
      | `A` |
      | `S` |
      | `D` |

    Examples: arrow keys
      | key           |
      | the up arrow    |
      | the down arrow  |
      | the left arrow  |
      | the right arrow |

  @D18
  Scenario: a key that is not a direction key or a quit key is ignored
    Given the seed is 1
    When the player runs `pipeline play`, presses `x`, then the quit key `q`
    Then stdout holds exactly 2 frames
    And the two frames are identical
    And the exit code is 0

  @D16 @D19
  Scenario: the loop repeats for as long as keys arrive
    Given the seed is 1
    When the player runs `pipeline play`, presses `a`, presses `a`, then the quit key `q`
    Then stdout holds exactly 3 frames
    And all 3 frames are identical
    And the exit code is 0

  @D1
  Scenario: the frame shows nothing that this feature does not yet implement
    When the player runs `pipeline play` and immediately presses the quit key `q`
    Then the frame holds only the title, the grid and the hint
    And the frame shows no score, no win message and no game-over message


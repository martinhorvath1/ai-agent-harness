Feature: 2048 playable game
  A player runs `pipeline play` and plays 2048 to a finish: tiles slide and merge, a new tile
  spawns after every move that changed the board, the score rises, a win is announced at 2048,
  and the run ends when no legal move remains.

  Notation: a line of four cells is written left to right as `2 2 4 4`, and the word `empty`
  stands for an empty cell. For a row, the leftmost cell is written first; for a column, the
  topmost cell is written first.

  Background:
    Given the `pipeline` command is available

  # --- slide and merge -------------------------------------------------------

  @D2
  Scenario Outline: tiles slide to the leading edge and merge at most once per move
    Given a board whose top row is `<before>` and whose other cells are empty
    When the move <direction> is applied
    Then the top row of the resulting board is `<after>`

    Examples: pressed left, resolved from the leading edge
      | before            | direction | after                 |
      | 2 2 4 4           | left      | 4 8 empty empty       |
      | 2 2 4 empty       | left      | 4 4 empty empty       |
      | 4 4 4 empty       | left      | 8 4 empty empty       |
      | 2 empty empty 2   | left      | 4 empty empty empty   |
      | 2 empty 4 empty   | left      | 2 4 empty empty       |
      | 8 4 2 2           | left      | 8 4 4 empty           |

    Examples: pressed right, resolved from the leading edge
      | before            | direction | after                 |
      | 2 2 4 4           | right     | empty empty 4 8       |
      | 4 4 4 empty       | right     | empty empty 4 8       |
      | 2 empty empty 2   | right     | empty empty empty 4   |

  @D2
  Scenario Outline: a column slides and merges the same way
    Given a board whose left column is `<before>` and whose other cells are empty
    When the move <direction> is applied
    Then the left column of the resulting board is `<after>`

    Examples:
      | before            | direction | after                 |
      | 2 2 4 4           | up        | 4 8 empty empty       |
      | 4 4 4 empty       | up        | 8 4 empty empty       |
      | 2 2 4 4           | down      | empty empty 4 8       |
      | empty 2 empty 2   | down      | empty empty empty 4   |

  # --- the no-op move --------------------------------------------------------

  @D3
  Scenario Outline: a no-op move spawns nothing and scores nothing
    Given a board whose top row is `<row>` and whose other cells are empty
    And the score is 7
    When the player presses <direction>
    Then the board is unchanged
    And no tile has spawned
    And the score is still 7
    And the frame is drawn again

    Examples:
      | row                 | direction |
      | 2 4 empty empty     | left      |
      | empty empty 2 4     | right     |

  @D13
  Scenario: a direction key now changes the board
    Given a board whose top row is `2 2 empty empty` and whose other cells are empty
    When the player presses left
    Then the board is not the board it was before the move

  # --- the spawn -------------------------------------------------------------

  @D4 @D5
  Scenario: a move that changed the board spawns one new tile on an empty cell
    Given a board whose top row is `2 2 empty empty` and whose other cells are empty
    When the player presses left
    Then the board holds exactly 2 tiles
    And one of them is the tile the merge produced
    And the other is a new tile of 2 or 4 on a cell that was empty

  @D4 @D5
  Scenario Outline: a spawned tile is a 2 with probability 0.9 and a 4 with probability 0.1
    Given a board whose top row is `2 2 empty empty` and whose other cells are empty
    And the random source yields <value> when the spawn draws the tile value
    When the player presses left
    Then the new tile is <tile>

    Examples:
      | value | tile |
      | 0.0   | 4    |
      | 0.05  | 4    |
      | 0.1   | 2    |
      | 0.5   | 2    |
      | 0.99  | 2    |

  @D4 @D5
  Scenario: the spawn lands on a uniformly chosen empty cell
    Given a board whose top row is `2 2 empty empty` and whose other cells are empty
    And the random source yields a value near 1 when the spawn draws the cell
    When the player presses left
    Then the new tile is on one of the last empty cells, not the first

  @D5 @D15
  Scenario: a seeded run is reproducible
    Given the seed is 1
    When the player runs `pipeline play`, presses `a`, presses `a`, then the quit key `q`, twice
    Then both runs print byte-identical output
    And the exit code is 0

  # --- the score -------------------------------------------------------------

  @D6
  Scenario Outline: the score rises by the value of each tile a merge produces
    Given a board whose top row is `<row>` and whose other cells are empty
    And the score is 0
    When the player presses left
    Then the score is <score>

    Examples:
      | row                 | score |
      | 4 4 empty empty     | 8     |
      | 2 2 4 4             | 12    |
      | 4 4 4 empty         | 8     |
      | 2 4 empty 2         | 0     |

  @D6 @D7
  Scenario: the two opening tiles score nothing
    Given the seed is 1
    When the player runs `pipeline play` and immediately presses the quit key `q`
    Then the second line of the frame is `Score: 0`

  # --- the frame -------------------------------------------------------------

  @D7 @D15
  Scenario: a frame with no status line reads title, score, blank, grid, blank, hint
    Given the seed is 1
    When the player runs `pipeline play` and immediately presses the quit key `q`
    Then stdout holds exactly one frame
    And the first line of the frame is `2048`
    And the second line of the frame is `Score: 0`
    And the third line of the frame is blank
    And the next lines are a box-drawing grid of 4 rows and 4 cells per row
    And every cell of the grid is 6 characters wide
    And the line after the grid is blank
    And the frame has no status line
    And the last line of the frame is `Arrows/WASD to move - q to quit`

  @D7 @D8
  Scenario: the frame gains a status line between the grid and the hint when one applies
    Given a board that holds a tile of 2048
    When the frame is drawn
    Then the line after the blank that follows the grid is `You win!`
    And the last line of the frame is `Arrows/WASD to move - q to quit`

  # --- the win ---------------------------------------------------------------

  @D8
  Scenario: reaching 2048 announces a win and the run keeps going
    Given a board whose top row is `1024 1024 empty empty` and whose other cells are empty
    When the player presses left
    Then the board holds a tile of 2048
    And the status line reads `You win!`
    And the run has not ended

  @D8
  Scenario: the win status stays on every later frame
    Given a board whose top row is `1024 1024 empty empty` and whose other cells are empty
    When the player presses left
    And the player presses down
    Then the status line still reads `You win!`

  # --- the loss --------------------------------------------------------------

  @D9
  Scenario: the run ends when no legal move remains
    Given a board with no empty cell and no pair of orthogonally adjacent equal tiles
    When the frame is drawn
    Then the status line reads `Game over`
    And the run ends without waiting for another key
    And the exit code is 0

  @D9
  Scenario: a full board with an adjacent equal pair is not game over
    Given a board with no empty cell and one pair of orthogonally adjacent equal tiles
    When the frame is drawn
    Then the frame has no status line
    And the run has not ended

  @D11
  Scenario: the spawned tile can fill the last cell and end the run in the same frame
    Given a board with exactly one empty cell, where the move leaves no pair of orthogonally adjacent equal tiles
    And the random source is set so the spawn fills that last empty cell
    When the player presses left
    Then the board has no empty cell
    And the status line of that same frame reads `Game over`
    And the run ends without waiting for another key

  @D10
  Scenario: Game over replaces You win! on the final frame of a won game
    Given a game that has already been won
    And the board reaches a position with no empty cell and no pair of orthogonally adjacent equal tiles
    When the frame is drawn
    Then the status line reads `Game over`
    And the frame does not mention `You win!`

  # --- keys ------------------------------------------------------------------

  @D12
  Scenario: a key that is neither a direction key nor a quit key is ignored
    Given the seed is 1
    When the player runs `pipeline play`, presses `x`, then the quit key `q`
    Then stdout holds exactly 2 frames
    And the two frames are identical
    And the exit code is 0

  @D1
  Scenario: a player plays a seeded game end to end
    Given the seed is 1
    When the player runs `pipeline play`, presses `a`, presses `s`, presses `d`, presses `w`, then the quit key `q`
    Then stdout holds exactly 5 frames
    And not all 5 frames are identical
    And every frame reads title, score, blank, grid, blank, optional status line, hint
    And the score on the last frame is at least the score on the first frame
    And the exit code is 0

  # --- assertions re-homed from the retired baseline suite --------------------

  @D15
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

  @D15
  Scenario: a 4 can appear as an opening tile
    Given the seed is chosen so that the random source yields a value below 0.1 for a tile value
    When the player runs `pipeline play` and immediately presses the quit key `q`
    Then at least one tile on the opening board is 4

  @D15
  Scenario Outline: a seed that is not a non-negative integer no greater than 4294967295 is an error
    Given the seed is <seed>
    When the player runs `pipeline play`
    Then stderr mentions the seed `PIPELINE_SEED`
    And the exit code is 1
    And no frame is printed

    Examples: rejected seeds
      | seed       |
      | abc        |
      | 4294967296 |

  @D15
  Scenario: play takes no arguments
    When the player runs `pipeline play extra`
    Then stderr contains `usage: play`
    And the exit code is 1

  @D15
  Scenario: an unrecognised command name is reported
    When the player runs `pipeline nope`
    Then stderr contains `unknown command: nope`
    And the exit code is 1

  @D15
  Scenario: end of input ends the loop
    Given stdin is closed without any key being pressed
    When the player runs `pipeline play`
    Then stdout holds exactly 1 frame
    And the exit code is 0

  @D15
  Scenario: piped output carries no escape codes
    Given stdin is a pipe, not a TTY
    When the player runs `pipeline play` and immediately presses the quit key `q`
    Then stdout contains no ANSI escape codes
    And the exit code is 0

  # --- what this feature does not add -----------------------------------------

  @D16
  Scenario: the command surface, the board and the hint are unchanged
    Given the seed is 1
    When the player runs `pipeline --help`
    Then stdout lists the command `play` and no other command
    And the exit code is 0
    When the player runs `pipeline play` and immediately presses the quit key `q`
    Then the board in the frame has 16 cells in 4 rows of 4
    And the last line of the frame is `Arrows/WASD to move - q to quit`
    And no environment variable other than `PIPELINE_SEED` affects the run

  @D13 @D14
  Scenario: the retired baseline acceptance suite leaves nothing behind
    Given this feature has replaced the baseline acceptance suite
    Then the directory `tests/acceptance/baseline/` does not exist
    And the file `specs/baseline/acceptance.sha256` does not exist

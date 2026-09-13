/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // --- general hygiene ---
    { name: "no-circular", severity: "error",
      comment: "Circular dependencies mean two modules are really one, or a function is misplaced.",
      from: {}, to: { circular: true } },
    { name: "no-orphans", severity: "error",
      comment: "Files nothing imports are dead code or forgotten wiring.",
      from: { orphan: true, pathNot: ["\\.d\\.ts$", "^src/cli/main\\.ts$", "^tests/"] }, to: {} },

    // --- core stays pure ---
    { name: "core-no-cli", severity: "error",
      from: { path: "^src/core/" }, to: { path: "^src/cli/" } },
    { name: "core-no-node-builtins", severity: "error",
      comment: "No I/O in core. Inject what you need.",
      from: { path: "^src/core/" }, to: { dependencyTypes: ["core"] } },
    { name: "core-no-npm", severity: "error",
      comment: "Core has no runtime dependencies. Ask a human if one is needed.",
      from: { path: "^src/core/" }, to: { dependencyTypes: ["npm"] } },

    // --- layering inside core: lower layers never import higher ones ---
    { name: "model-is-bottom", severity: "error",
      from: { path: "^src/core/model/" }, to: { path: "^src/core/(rules|game)/" } },
    { name: "rules-below-game", severity: "error",
      from: { path: "^src/core/rules/" }, to: { path: "^src/core/game/" } },
    { name: "only-index-imports-game-publicly", severity: "error",
      comment: "Internals never import the barrel; that is backwards.",
      from: { path: "^src/core/(model|rules|game)/" }, to: { path: "^src/core/index\\.ts$" } },

    // --- public API boundary ---
    { name: "cli-uses-public-api", severity: "error",
      comment: "The shell may only use core's public API.",
      from: { path: "^src/cli/" }, to: { path: "^src/core/", pathNot: "^src/core/index\\.ts$" } },
    { name: "acceptance-tests-use-public-api", severity: "error",
      comment: "Acceptance tests prove behavior, not internals. This rule binds only "
        + "tests/acceptance/: unit tests, including the hardener's *.mutation.test.ts, "
        + "import src/ directly, because a mutant can live in a file the public API "
        + "never re-exports, and locking the hardener out of it produces false "
        + "UNTESTABLE verdicts instead of better tests.",
      from: { path: "^tests/acceptance/" },
      to: { path: "^src/", pathNot: ["^src/core/index\\.ts$", "^src/cli/render\\.ts$"] } },
  ],
  options: {
    tsConfig: { fileName: "tsconfig.json" },
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
  },
};

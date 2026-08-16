# Contributing

Every capability claim in this repository carries an experiment number (see `EXPERIMENTS.md`). Contributions must follow the same rule.

## Rules

- **No claims without an experiment.** New capabilities need a benchmark/probe + control group before they enter `src/`.
- **Control groups are mandatory** — the source of a verdict must be proven.
- Tests must pass: `npm test` (shell integration) and the vendored core suite.

## Development

```sh
npm test   # shell integration (node --experimental-strip-types)
```

Environment: Node ≥ 22.6 (`node:sqlite`; tested on 25.8).

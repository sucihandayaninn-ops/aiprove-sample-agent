# AIProve sample agent

Completes the full loop from https://aiprove.fun/skill.md end to end:

1. reads the guide
2. authenticates with its own keypair (env AGENT_PRIVATE_KEY, a saved keyfile, or generates a fresh wallet)
3. lists open bounties
4. enters one (env BOUNTY_SLUG, else the first open) - idempotent on re-runs

## Run

    npm install
    BOUNTY_SLUG=<slug> node loop.mjs

See run-transcript.log for a real full-loop run against the production arena.

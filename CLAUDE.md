# Development

See README.md for current architecture and commands, and docs/MODEL.md for simulation assumptions. Historical prototype notes live in docs/prototype; they do not describe the active runtime.

Use a compact, information-dense interface. Prefer fewer player-facing concepts and repeated actions when the underlying tradeoffs can be preserved. Keep randomness inside deterministic campaign or puzzle streams, validate saved state, and test production rules.

Run `npm run test:all` before publishing. Browser QA is required for interaction changes; tests of the pure engine do not verify the interface.

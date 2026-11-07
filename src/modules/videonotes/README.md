# Videonotes

A module for Design Studio. It adds a page at `/videonotes` and a button for it on the rail.

- `module.ts` says what it is and what it adds.
- `app.tsx` is the page and the rail button.
- `context/` holds knowledge and requirements for this capability.
- [Use Videonotes](skills/use-videonotes/SKILL.md) is its task procedure. AGENTS.md routes agents to it while the module is enabled.

This README is the entry point and technical contract. The shared Context and Skills browser reads the original module files. See the [module contract](../../platform/context/modules.md) for extension details.

To reuse it in another studio, review and copy its source into the team module root, declare availability and dependencies, and run `pnpm studio sync`, `pnpm check`, and `pnpm build`.

---
name: use-rounds
description: Set up a decision round (.round) comparing prototype files, or read which option won and why.
---

A `.round` file compares files in the same prototype:

```json
{ "studioId": "…", "question": "Which toast style ships?",
  "options": [{ "n": 1, "path": "toast_card_1.swiftview", "label": "Glass", "status": "open" }],
  "decision": null }
```

Option numbers are permanent: add new ones one past the highest ever used, never renumber. Status is `open`, `picked`, `rejected` or `superseded`. Paths are relative to the `.round` file. The person records the pick on the page (why, follow-up checks); read `decision` for it, and treat unchecked `checks` as open work. After writing a new round, run `pnpm studio identify <prototype folder> --yes`, then `pnpm check`.

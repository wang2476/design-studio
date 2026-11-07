---
name: use-videonotes
description: Read or add notes on reference clips (.videonotes) in Design Studio.
---

A `.videonotes` file sits beside its clip in a prototype:

```json
{ "studioId": "…", "video": "clip.mp4", "summary": "Why this clip is here",
  "notes": [{ "id": "n_ab12cd", "t": 2.5, "text": "Borrow this ease", "author": "claude", "createdAt": "ISO date" }] }
```

`t` is seconds into the clip, or `null` for the whole clip. To add a note, append to `notes` with `"author": "claude"` and a new `n_` id, keeping every other field. To add a clip, put the video in the prototype, write the file, then run `pnpm studio identify <prototype folder> --yes`. Verify with `pnpm check`.

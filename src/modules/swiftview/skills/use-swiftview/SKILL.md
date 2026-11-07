---
name: use-swiftview
description: Render SwiftUI #Previews into Design Studio as Swift views, inspect tagged elements, and act on fix prompts.
---

A Swift view is a `.swiftview` JSON beside its PNG in a prototype: the render, its size in points, and each `.designTag` element with `file:line` and frame.

**Render or re-render:** `pnpm swift <Lab.swift under ios/> <name> <contributor>/<prototype folder>`, for example `pnpm swift App/DesignLab/ToastCardLab.swift toast_card aaron/layer-swift-spike`. The iOS app checkout comes from `SWIFT_APP_ROOT` (default `~/Documents/GitHub/layer-designlab`). New files get a studioId automatically; re-renders keep theirs. The page's **Re-render** button repeats the same render from the view's `source`.

**Fix prompt:** names the tag, `file:line` and frame. Edit that line in the app repo, then re-render. HTML drafts for iOS are references only; the Swift view is the real code.

**Verify:** the command prints the written files; open the view and confirm the tag boxes sit on the elements.

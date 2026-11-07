import type { ModuleSpec } from '#studio/module';

// Swift views: SwiftUI #Preview renders (PNG) with their tagged element frames, from Layer's DesignLab
// renderer (axe). The artifact is the .swiftview JSON; the PNG beside it is a plain asset.
export default {
  lib: false,
  id: 'swiftview',
  label: 'Swift views',
  version: '0.1.0',
  requires: '0.1.3',
  description: 'Open SwiftUI preview renders and inspect their tagged elements at 1 pt = 1 px.',
  optional: true,
  instructions: [{ path: 'skills/use-swiftview/', when: 'asks about Swift views' }],
} satisfies ModuleSpec;

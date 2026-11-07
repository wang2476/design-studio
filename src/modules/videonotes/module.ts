import type { ModuleSpec } from '#studio/module';

// Video notes: a reference clip with a summary and notes pinned to moments in it, ported from DesignLab's
// moodboard videos. The artifact is the .videonotes JSON; the video beside it is a plain asset.
export default {
  lib: false,
  id: 'videonotes',
  label: 'Video notes',
  version: '0.1.0',
  requires: '0.1.3',
  description: 'Keep reference clips with notes pinned to the moment they describe.',
  optional: true,
  instructions: [{ path: 'skills/use-videonotes/', when: 'asks about video notes or reference clips' }],
} satisfies ModuleSpec;

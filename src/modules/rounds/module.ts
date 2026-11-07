import type { ModuleSpec } from '#studio/module';

// Decision rounds, ported from DesignLab: a question, the artifacts that answer it as numbered options, and
// the recorded pick with why, what each option cost, and follow-up checks. The artifact is the .round JSON.
export default {
  lib: false,
  id: 'rounds',
  label: 'Decision rounds',
  version: '0.1.0',
  requires: '0.1.3',
  description: 'Compare options side by side and record which one won and why.',
  optional: true,
  instructions: [{ path: 'skills/use-rounds/', when: 'asks about decision rounds, options, or recording a design decision' }],
} satisfies ModuleSpec;

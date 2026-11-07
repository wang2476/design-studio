import { defineFileType, jsonIdentityMetadata } from '#studio/files';
import { parseVideoNotes } from './videoNotes.ts';

export default defineFileType({
  label: 'Video notes',
  extensions: ['.videonotes'],
  language: 'json',
  systemUsage: 'independent',
  inPrototype: true,
  inSystemContent: false,
  fallback: false,
  capabilities: { source: true, create: false, fidelity: false, embeds: ['document', 'canvas'], actions: [] },
  identity: jsonIdentityMetadata,
  check: ({ source }) => {
    const parsed = parseVideoNotes(source);
    return 'error' in parsed ? [parsed.error] : [];
  },
});

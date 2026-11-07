import { defineFileType, jsonIdentityMetadata } from '#studio/files';
import { parseRound } from './round.ts';

export default defineFileType({
  label: 'Decision round',
  extensions: ['.round'],
  language: 'json',
  systemUsage: 'independent',
  inPrototype: true,
  inSystemContent: false,
  fallback: false,
  capabilities: { source: true, create: false, fidelity: false, embeds: [], actions: [] },
  identity: jsonIdentityMetadata,
  check: ({ source }) => {
    const parsed = parseRound(source);
    return 'error' in parsed ? [parsed.error] : [];
  },
});

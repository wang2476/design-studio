// A .swiftview file: JSON naming a rendered PNG beside it and the frames of its tagged elements.
import { defineFileType, jsonIdentityMetadata } from '#studio/files';
import { parseSwiftView } from './swiftView.ts';

export default defineFileType({
  label: 'Swift view',
  extensions: ['.swiftview'],
  language: 'json',
  systemUsage: 'independent',
  inPrototype: true,
  inSystemContent: false,
  fallback: false,
  capabilities: { source: true, create: false, fidelity: false, embeds: ['document', 'canvas'], actions: [] },
  identity: jsonIdentityMetadata,
  check: ({ source }) => {
    const parsed = parseSwiftView(source);
    return 'error' in parsed ? [parsed.error] : [];
  },
});

// Sidecar text for the deployed site (['/__studio_globs__/*'] becomes this type's patterns), and every
// prototype PNG as a URL, so a view can show the image it names. Vite's root is src/, so keys start at /prototypes/.
export const files = import.meta.glob<string>(['/__studio_globs__/*'], { query: '?raw', import: 'default' });
export const images = import.meta.glob<string>('/prototypes/**/*.png', { query: '?url', import: 'default', eager: true });

if (import.meta.hot) import.meta.hot.accept();

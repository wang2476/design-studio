export const files = import.meta.glob<string>(['/__studio_globs__/*'], { query: '?raw', import: 'default' });
export const videos = import.meta.glob<string>('/prototypes/**/*.{mp4,webm,mov,m4v}', { query: '?url', import: 'default', eager: true });
if (import.meta.hot) import.meta.hot.accept();

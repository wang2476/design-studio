export const files = import.meta.glob<string>(['/__studio_globs__/*'], { query: '?raw', import: 'default' });
if (import.meta.hot) import.meta.hot.accept();

// Dynamic Expo config for CFB Gridiron AI. Reads the static app.json and lets the
// web base path be overridden at build time via EXPO_BASE_URL, so the same
// bundle can be served from a domain root (default) or a sub-path, e.g.
//   EXPO_BASE_URL=/CFB-Gridiron-AI npx expo export --platform web
module.exports = ({ config }) => {
  const baseUrl = process.env.EXPO_BASE_URL ?? config.experiments?.baseUrl ?? '';
  return {
    ...config,
    experiments: {
      ...config.experiments,
      baseUrl,
    },
  };
};

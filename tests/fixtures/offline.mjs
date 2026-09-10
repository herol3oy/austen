// Loaded only into the isolated static build test.
// Opt out before Astro loads; a fresh CI machine has telemetry enabled by default.
process.env.ASTRO_TELEMETRY_DISABLED = '1';
globalThis.fetch = () => { throw new Error('Static build attempted network access'); };

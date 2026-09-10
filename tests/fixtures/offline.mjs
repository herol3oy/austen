// Loaded only into the isolated static build test.
globalThis.fetch = () => { throw new Error('Static build attempted network access'); };

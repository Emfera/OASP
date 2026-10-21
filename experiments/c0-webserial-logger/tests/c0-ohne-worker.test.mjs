// Gleicher Test, aber mit erzwungenem Ausweichweg (OPFS im Hauptthread), wie in eingebetteten Vorschauen.
process.env.C0_QUERY = '?noworker';
await import('./c0.test.mjs');

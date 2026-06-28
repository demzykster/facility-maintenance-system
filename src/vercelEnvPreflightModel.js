export function parseVercelEnvListOutput(text = "") {
  const names = new Set();
  const envName = /^[A-Z][A-Z0-9_]*$/;

  for (const rawLine of String(text || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith(">") || line.startsWith("Vercel CLI")) continue;
    for (const token of line.split(/\s+/)) {
      const clean = token.replace(/[│┃|,;:]/g, "").trim();
      if (envName.test(clean)) names.add(clean);
    }
  }

  return names;
}

export function vercelEnvPreflight({ foundNames = new Set(), required = [], optional = [] } = {}) {
  const found = foundNames instanceof Set ? foundNames : new Set(foundNames || []);
  const missing = required.filter((name) => !found.has(name));
  const optionalMissing = optional.filter((name) => !found.has(name));

  return {
    ok: missing.length === 0,
    found: [...found].sort(),
    missing,
    optionalMissing
  };
}

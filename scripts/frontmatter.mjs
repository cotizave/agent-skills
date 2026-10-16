// Subconjunto YAML explícito del repositorio, no un parser YAML general.
// Rechaza sintaxis no soportada en vez de aceptarla con otra interpretación.
export function parseFrontmatter(text) {
  const match = text.replace(/\r\n/g, "\n").match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (!match) throw new Error("falta frontmatter YAML delimitado");
  const data = Object.create(null);
  const lines = match[1].split("\n");
  const put = (map, key, value) => {
    if (Object.hasOwn(map, key)) throw new Error(`campo duplicado: ${key}`);
    map[key] = value;
  };
  const scalar = (value) => {
    if (value.startsWith('"')) {
      try {
        const parsed = JSON.parse(value);
        if (typeof parsed === "string") return parsed;
      } catch { /* unsupported/invalid scalar */ }
      throw new Error("string entre comillas dobles inválido");
    }
    if (value.startsWith("'")) {
      if (!/^'(?:[^']|'')*'$/.test(value)) throw new Error("string entre comillas simples inválido");
      return value.slice(1, -1).replace(/''/g, "'");
    }
    if (!value || /^(?:true|false|null|~|[-+]?\.inf|\.nan)$/i.test(value) || /^[-+]?(?:\d|\.\d)/.test(value) ||
        /^[!&*\[\]{}>|%@`?#,:-]/.test(value) || /:\s|\s#/.test(value)) {
      throw new Error("se requiere string; cita escalares ambiguos o sintaxis YAML compleja");
    }
    return value;
  };
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim() || /^#/.test(lines[i])) continue;
    const top = lines[i].match(/^([a-z][a-z0-9-]*):(?: (.*))?$/);
    if (!top) throw new Error("línea de frontmatter no soportada");
    const [, key, rest = ""] = top;
    if (key === "metadata") {
      if (rest !== "") throw new Error("metadata debe ser un mapa indentado");
      const map = Object.create(null);
      while (i + 1 < lines.length && /^ /.test(lines[i + 1])) {
        const entry = lines[++i].match(/^  ([A-Za-z0-9_.-]+): (.+)$/);
        if (!entry) throw new Error("entrada metadata inválida");
        put(map, entry[1], scalar(entry[2]));
      }
      put(data, key, map);
    } else if (rest === ">-" || rest === "|-") {
      const block = [];
      while (i + 1 < lines.length && /^  \S/.test(lines[i + 1])) block.push(lines[++i].slice(2));
      if (!block.length) throw new Error("bloque vacío");
      put(data, key, block.join(rest === ">-" ? " " : "\n"));
    } else {
      put(data, key, scalar(rest));
    }
  }
  const allowed = new Set(["name", "description", "license", "compatibility", "metadata", "allowed-tools"]);
  for (const key of Object.keys(data)) if (!allowed.has(key)) throw new Error(`campo no soportado: ${key}`);
  for (const key of ["name", "description"]) {
    if (typeof data[key] !== "string" || !data[key].trim()) throw new Error(`falta ${key}`);
  }
  if (data.compatibility && data.compatibility.length > 500) throw new Error("compatibility supera 500 caracteres");
  return { data, bodyStartLine: match[0].split("\n").length };
}

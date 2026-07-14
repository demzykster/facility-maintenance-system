const cleanText = (value, limit = 200) => String(value || "")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, limit);

function typeMatches(value, type = "") {
  if (!type) return true;
  if (type === "array") return Array.isArray(value);
  if (type === "object") return value && typeof value === "object" && !Array.isArray(value);
  if (type === "string") return typeof value === "string";
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  if (type === "boolean") return typeof value === "boolean";
  return true;
}

function validateSchema(schema = {}, value = {}, label = "capability_input") {
  if (!schema || typeof schema !== "object") return;
  if (schema.type && !typeMatches(value, schema.type)) throw new Error(`${label}_schema_invalid:type`);
  const properties = schema.properties && typeof schema.properties === "object" ? schema.properties : {};
  for (const key of Array.isArray(schema.required) ? schema.required : []) {
    if (value?.[key] === undefined || value?.[key] === null) {
      throw new Error(`${label}_schema_invalid:required:${key}`);
    }
  }
  for (const [key, propertySchema] of Object.entries(properties)) {
    if (value?.[key] === undefined || value?.[key] === null || propertySchema?.type === undefined) continue;
    if (!typeMatches(value[key], propertySchema.type)) throw new Error(`${label}_schema_invalid:type:${key}`);
  }
}

export const CAPABILITY_RISK = Object.freeze({
  read: "read",
  lowWrite: "low_write"
});

export class AiCapabilityRegistry {
  constructor(capabilities = []) {
    this.capabilities = new Map();
    capabilities.forEach((capability) => this.register(capability));
  }

  register(capability = {}) {
    const name = cleanText(capability.name, 120);
    if (!name) throw new Error("capability_name_required");
    this.capabilities.set(name, Object.freeze({ ...capability, name }));
    return this;
  }

  get(name = "") {
    return this.capabilities.get(cleanText(name, 120)) || null;
  }

  list() {
    return [...this.capabilities.values()];
  }

  async execute(name = "", args = {}, context = {}) {
    const capability = this.get(name);
    if (!capability) throw new Error("capability_not_allowed");
    if (typeof capability.execute !== "function") throw new Error("capability_execute_missing");
    validateSchema(capability.inputSchema, args, "capability_input");
    const result = await capability.execute(args, context);
    validateSchema(capability.outputSchema, result, "capability_output");
    return result;
  }
}

export function createAiCapabilityRegistry(capabilities = []) {
  return new AiCapabilityRegistry(capabilities);
}

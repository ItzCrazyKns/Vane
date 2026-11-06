import z from 'zod';

/**
 * Converts the JSON Schema of an MCP tool's input into zod, because Vane's
 * tool definitions are zod objects (sent back out with z.toJSONSchema).
 * Covers the subset tool schemas use in practice; anything else becomes
 * z.any() so the model can still pass it through.
 */
export const jsonSchemaToZod = (schema: any): z.ZodTypeAny => {
  if (!schema || typeof schema !== 'object') return z.any();

  let out: z.ZodTypeAny;

  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    out = schema.enum.every((v: unknown) => typeof v === 'string')
      ? z.enum(schema.enum as [string, ...string[]])
      : z.any();
  } else {
    const type = Array.isArray(schema.type)
      ? schema.type.find((t: string) => t !== 'null')
      : schema.type;

    switch (type) {
      case 'string':
        out = z.string();
        break;
      case 'integer':
        out = z.number().int();
        break;
      case 'number':
        out = z.number();
        break;
      case 'boolean':
        out = z.boolean();
        break;
      case 'array':
        out = z.array(jsonSchemaToZod(schema.items));
        break;
      case 'object':
        out = jsonObjectToZod(schema);
        break;
      default:
        out = schema.properties ? jsonObjectToZod(schema) : z.any();
    }
  }

  if (typeof schema.description === 'string' && schema.description) {
    out = out.describe(schema.description);
  }
  return out;
};

export const jsonObjectToZod = (schema: any): z.ZodObject<any> => {
  const props: Record<string, any> =
    schema && typeof schema.properties === 'object' ? schema.properties : {};
  const required = new Set<string>(
    Array.isArray(schema?.required) ? schema.required : [],
  );

  const shape: Record<string, z.ZodTypeAny> = {};
  for (const [key, prop] of Object.entries(props)) {
    const field = jsonSchemaToZod(prop);
    shape[key] = required.has(key) ? field : field.optional();
  }
  return z.object(shape);
};

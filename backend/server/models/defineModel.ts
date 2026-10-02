import mongoose, { type Schema } from "mongoose";

/**
 * Register a model once. Next.js dev hot-reload (and verify harnesses that import
 * server code alongside the running app) evaluate model files more than once;
 * plain `model()` would throw OverwriteModelError on the second evaluation.
 *
 * But a cached model must never outlive a schema change: if the model file was
 * edited (e.g. a new field) while `next dev` keeps running, the old model would
 * silently drop the new field on save (strict mode). So when the registered
 * schema's fields differ from this one, the model is re-registered.
 * (Default import: `models` isn't exposed as an ESM named export of mongoose.)
 */
export function defineModel<TSchema extends Schema>(name: string, schema: TSchema) {
  const make = () => mongoose.model(name, schema);
  const existing = mongoose.models[name] as ReturnType<typeof make> | undefined;
  if (existing && sameFields(existing.schema, schema)) return existing;
  if (existing) mongoose.deleteModel(name);
  return make();
}

function sameFields(a: Schema, b: Schema): boolean {
  const sig = (s: Schema) =>
    Object.entries(s.paths)
      .map(([p, t]) => `${p}:${(t as { instance?: string }).instance ?? ""}`)
      .sort()
      .join("|");
  return sig(a) === sig(b);
}

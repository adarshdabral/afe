import mongoose, { type Schema } from "mongoose";

/**
 * Register a model once. Next.js dev hot-reload (and verify harnesses that import
 * server code alongside the running app) evaluate model files more than once;
 * plain `model()` would throw OverwriteModelError on the second evaluation.
 * (Default import: `models` isn't exposed as an ESM named export of mongoose.)
 */
export function defineModel<TSchema extends Schema>(name: string, schema: TSchema) {
  const make = () => mongoose.model(name, schema);
  return (mongoose.models[name] as ReturnType<typeof make> | undefined) ?? make();
}

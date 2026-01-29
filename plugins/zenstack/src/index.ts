export type AurexModel = {
  aurexFields: string[];
  name: string;
  prefix: string;
};

export type ReadonlyAurexModel = {
  readonly name: string;
  readonly prefix: string;
  readonly aurexFields: readonly string[];
};

export { plugin as default } from "./cli-plugin";

export { AurexPlugin } from "./runtime-plugin";
export type { Manifest as AurexRuntimePluginOptions } from "./runtime-plugin";

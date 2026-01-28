export type AurexModel = {
  idFields: string[];
  name: string;
  prefix: string;
};

export { plugin as default } from "./cli-plugin";

export { AurexPlugin } from "./runtime-plugin";
export type { AurexRuntimePluginOptions } from "./runtime-plugin";

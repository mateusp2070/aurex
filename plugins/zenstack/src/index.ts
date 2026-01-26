import { promises as fs } from "fs";
import path from "path";
import { isDataModel } from "@zenstackhq/language/ast";
import {
  type CliGeneratorContext,
  type CliPlugin,
  ModelUtils,
} from "@zenstackhq/sdk";
import { AurexCore } from "aurex/server";

const DEFAULT_FILE_NAME = "aurex-models.json";

const aurexCore = new AurexCore();

type AurexModel = {
  name: string;
  prefix: string;
};

function getStringOption(
  options: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = options[key];
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function resolveOutputPath(context: CliGeneratorContext): string {
  const options = context.pluginOptions ?? {};
  const outputFile = getStringOption(options, "outputFile");
  if (outputFile) {
    return outputFile;
  }

  const outputDir =
    getStringOption(options, "outputDir") ?? context.defaultOutputPath;
  const fileName = getStringOption(options, "fileName") ?? DEFAULT_FILE_NAME;
  return path.join(outputDir, fileName);
}

function collectAurexModels(context: CliGeneratorContext): AurexModel[] {
  const models: AurexModel[] = [];
  for (const decl of context.model.declarations) {
    if (!isDataModel(decl)) {
      continue;
    }

    const aurexAttr = ModelUtils.getAttribute(decl, "aurex");
    const prefix = aurexCore.computeLuhnCheckChar(
      decl.name.padEnd(15, "A").slice(0, 15),
    );

    if (aurexAttr) {
      models.push({
        name: decl.name,
        prefix,
      });
    }
  }
  return models;
}

const plugin: CliPlugin = {
  name: "zenstack-aurex",
  statusText: "Gerando lista de modelos com @@aurex",
  async generate(context: CliGeneratorContext) {
    const outputPath = resolveOutputPath(context);
    const models = collectAurexModels(context);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    const payload = { models };
    await fs.writeFile(outputPath, JSON.stringify(payload, null, 2), "utf8");
  },
};

export default plugin;

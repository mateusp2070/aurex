import { invariant } from "@zenstackhq/common-helpers";
import {
  type CliGeneratorContext,
  ModelUtils,
  type CliPlugin,
} from "@zenstackhq/sdk";
import type { AurexModel } from "./index";
import { AurexCore, type AurexVariant } from "aurex/server";
import { createHash } from "crypto";
import path from "path";
import { promises as fs } from "fs";
import * as AST from "@zenstackhq/language/ast";

class AurexModelUtils {
  aurex = new AurexCore();
  options: Record<string, unknown>;

  constructor(public context: CliGeneratorContext) {
    this.options = context.pluginOptions;
  }

  getStringOption(key: string): string | undefined {
    const value = this.options[key];
    if (typeof value !== "string") {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  getAurexVariant(): AurexVariant {
    const variant = this.getStringOption("variant") || "A16";

    invariant(
      variant === "A16" || variant === "A24",
      `Invalid Aurex variant '${variant}'. Supported variants are A16, A24.`,
    );

    return variant;
  }

  createModelHash(name: string, prefixes: Set<string>): string {
    const hashed = this.aurex.encodeBase32Bits(
      createHash("sha1").update(name).digest().readUInt32BE(0),
      2,
    );

    invariant(
      !prefixes.has(hashed),
      `Hash collision for Model: ${name}. Set explicit prefix in @@aurex attribute.`,
    );

    prefixes.add(hashed);
    return hashed;
  }

  getAurexPrefix(
    attr: AST.DataModelAttribute | null,
    modelName: string,
    prefixes: Set<string>,
  ): string {
    const prefixArg = attr?.args.find((arg) => arg.name === "prefix");

    if (prefixArg && AST.isLiteralExpr(prefixArg.value)) {
      invariant(
        typeof prefixArg.value.value === "string",
        "Prefix must be a string literal.",
      );

      invariant(
        this.aurex.toValues(prefixArg.value.value).length === 2,
        "Prefix must be exactly 2 Base32 characters.",
      );

      invariant(
        !prefixes.has(prefixArg.value.value),
        `Duplicate prefix '${prefixArg.value.value}' found. Prefixes must be unique across models.`,
      );

      prefixes.add(prefixArg.value.value);

      return prefixArg.value.value;
    }

    return this.createModelHash(modelName, prefixes);
  }

  resolveOutputPath(): string {
    const outputDir = this.getStringOption("output") || "";

    return path.resolve(
      this.context.defaultOutputPath,
      outputDir,
      "aurex-manifest.ts",
    );
  }

  collectModels(): AurexModel[] {
    const models: AurexModel[] = [];
    const prefixes = new Set<string>();

    for (const decl of this.context.model.declarations) {
      if (!AST.isDataModel(decl)) {
        continue;
      }

      const aurexAttr = ModelUtils.getAttribute(decl, "aurex") || null;

      if (aurexAttr != null && !AST.isDataModelAttribute(aurexAttr)) continue;

      const prefix = this.getAurexPrefix(aurexAttr, decl.name, prefixes);

      const idFields = ModelUtils.getIdFields(decl);

      invariant(
        idFields.length > 0,
        `Model '${decl.name}' must have at least one ID field to be used with Aurex.`,
      );

      models.push({
        name: decl.name,
        prefix,
        idFields,
      });
    }
    return models;
  }
}

export const plugin: CliPlugin = {
  name: "zenstack-aurex-plugin",
  statusText: "Generating Aurex prefix table",
  async generate(context: CliGeneratorContext) {
    const utils = new AurexModelUtils(context);
    const outputPath = utils.resolveOutputPath();
    const models = utils.collectModels();
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    const payload = { models, variant: utils.getAurexVariant() };
    const jsonPayload = JSON.stringify(payload);
    await fs.writeFile(
      outputPath,
      `const manifest = ${jsonPayload} as const;\nexport default manifest;`,
      "utf8",
    );
  },
};

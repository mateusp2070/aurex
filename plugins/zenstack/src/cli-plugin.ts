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

function flatMixinFields(mixin: AST.Reference<AST.TypeDef>): AST.DataField[] {
  return [
    ...(mixin.ref?.fields || []),
    ...(mixin.ref?.mixins.flatMap((mixin) => flatMixinFields(mixin)) || []),
  ];
}

function flatBaseModelFields(
  baseModel: AST.Reference<AST.DataModel>,
): AST.DataField[] {
  return [
    ...(baseModel.ref?.$allFields || []),
    ...(baseModel.ref?.fields || []),
    ...(baseModel.ref?.mixins.flatMap((mixin) => flatMixinFields(mixin)) || []),
    ...(baseModel.ref?.baseModel
      ? flatBaseModelFields(baseModel.ref.baseModel)
      : []),
  ];
}

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

      let aurexFields = new Set<string>();

      const resolvedFields = [
        ...decl.mixins.flatMap(flatMixinFields),
        ...(decl.baseModel ? flatBaseModelFields(decl.baseModel) : []),
        ...(decl.$allFields || []),
        ...decl.fields,
      ];

      for (const field of resolvedFields) {
        const isAurexField = field.attributes.some((attr) => {
          return attr.decl.$refText === "@aurex";
        });

        if (isAurexField) {
          aurexFields.add(field.name);
        }
      }

      if (aurexFields.size === 0) {
        continue;
      }

      const aurexAttr = ModelUtils.getAttribute(decl, "aurex") || null;

      if (aurexAttr != null && !AST.isDataModelAttribute(aurexAttr)) continue;

      const prefix = this.getAurexPrefix(aurexAttr, decl.name, prefixes);

      models.push({
        name: decl.name,
        prefix,
        aurexFields: Array.from(aurexFields),
      });
    }
    return models;
  }
}

export const plugin: CliPlugin = {
  name: "zenstack-aurex",
  statusText: "Generating Aurex prefix table",

  async generate(context: CliGeneratorContext) {
    const utils = new AurexModelUtils(context);
    const outputPath = utils.resolveOutputPath();
    const models = utils.collectModels();
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    const payload = { models, variant: utils.getAurexVariant() };
    const jsonPayload = JSON.stringify(payload, null, 2);
    await fs.writeFile(
      outputPath,
      `const manifest = ${jsonPayload} as const;\nexport default manifest;`,
      "utf8",
    );
  },
};

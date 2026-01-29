import {
  OperationNodeTransformer,
  TableNode,
  type InsertQueryNode,
  type OperationNode,
  type QueryId,
  ColumnNode,
  PrimitiveValueListNode,
  ValueListNode,
  ValuesNode,
  ValueNode,
} from "kysely";
import type { AurexModel, ReadonlyAurexModel } from "./index";
import {
  Aurex16,
  Aurex24,
  type AurexVariant,
  type PrefixTable,
} from "aurex/server";
import type { OnKyselyQueryCallback, RuntimePlugin } from "@zenstackhq/orm";
import type { SchemaDef } from "@zenstackhq/orm/schema";

export type Manifest<Variant extends AurexVariant = AurexVariant> = {
  readonly models: readonly ReadonlyAurexModel[];
  readonly variant: Variant;
};

type InferAurex<M extends Manifest> = M["variant"] extends "A16"
  ? Aurex16<InferPrefixTable<M["models"]>>
  : M["variant"] extends "A24"
    ? Aurex24<InferPrefixTable<M["models"]>>
    : never;

type InferPrefixTable<M extends readonly ReadonlyAurexModel[]> = {
  [K in M[number]["name"]]: Extract<M[number], { name: K }>["prefix"];
};

function fromModelsToPrefixTable(
  models: readonly ReadonlyAurexModel[],
): PrefixTable {
  const prefixTable: PrefixTable = {};
  for (const model of models) {
    prefixTable[model.name] = model.prefix;
  }
  return prefixTable;
}

class AurexTransformer<M extends Manifest> extends OperationNodeTransformer {
  aurex: InferAurex<M>;

  constructor(public manifest: M) {
    super();

    this.aurex = (
      manifest.variant === "A16"
        ? new Aurex16(fromModelsToPrefixTable(manifest.models))
        : new Aurex24(fromModelsToPrefixTable(manifest.models))
    ) as InferAurex<M>;
  }

  protected override transformInsertQuery(
    node: InsertQueryNode,
    queryId?: QueryId,
  ): InsertQueryNode {
    if (!node.into || !node.columns || !node.values) {
      return super.transformInsertQuery(node, queryId);
    }

    const modelName = this.extractTableName(node.into);
    if (!modelName) {
      return super.transformInsertQuery(node, queryId);
    }

    const transformedValues = this.transformInsertValues(
      modelName,
      node.columns,
      node.values,
    );

    const baseResult = super.transformInsertQuery(node, queryId);

    return {
      ...baseResult,
      values: transformedValues,
    };
  }

  private extractTableName(tableNode: OperationNode | undefined) {
    if (!tableNode || !TableNode.is(tableNode)) {
      return undefined;
    }
    return tableNode.table.identifier.name;
  }

  private isAurexField(modelName: string, fieldName: string): boolean {
    const model = this.manifest.models.find(
      (m) => m.name === modelName && m.aurexFields.includes(fieldName),
    );

    return model !== undefined;
  }

  private transformInsertValues(
    modelName: string,
    columns: readonly ColumnNode[],
    values: OperationNode,
  ): OperationNode {
    if (!ValuesNode.is(values)) {
      return values;
    }

    const transformedValueLists = values.values.map((valueList) => {
      // Handle PrimitiveValueListNode (contains raw primitive values)
      if (PrimitiveValueListNode.is(valueList)) {
        const transformedValues = valueList.values.map((value, index) => {
          const fieldName = columns[index]?.column.name;

          if (!fieldName || !this.isAurexField(modelName, fieldName)) {
            return value;
          }

          return this.aurex.generateForTable(modelName);
        });

        return PrimitiveValueListNode.create(transformedValues);
      }

      // Handle ValueListNode (contains a list of ValueNode)
      const transformedValues = valueList.values.map((valueNode, index) => {
        const colNode = columns[index];
        if (!colNode) {
          return valueNode;
        }

        const fieldName = colNode.column.name;

        if (!this.isAurexField(modelName, fieldName)) {
          return valueNode;
        }

        return ValueNode.create(this.aurex.generateForTable(modelName));
      });

      return ValueListNode.create(transformedValues);
    });

    return ValuesNode.create(transformedValueLists);
  }
}

export class AurexPlugin<
  Schema extends SchemaDef,
  _Manifest extends Manifest,
> implements RuntimePlugin<Schema> {
  transformer: AurexTransformer<_Manifest>;
  aurex: AurexPlugin<Schema, _Manifest>["transformer"]["aurex"];

  constructor(public manifest: _Manifest) {
    this.transformer = new AurexTransformer(manifest);
    this.aurex = this.transformer.aurex;
  }

  get id() {
    return "zenstack-aurex";
  }

  get name() {
    return "Zenstack Aurex Plugin";
  }

  get description() {
    return "Aurex integration plugin for Zenstack ORM";
  }

  onKyselyQuery: OnKyselyQueryCallback<Schema> = (args) => {
    const transformedQuery = this.transformer.transformNode(args.query);

    // proceed with the transformed query
    return args.proceed(transformedQuery);
  };
}

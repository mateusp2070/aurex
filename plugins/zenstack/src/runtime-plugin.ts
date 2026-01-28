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
import type { AurexModel } from "./index";
import {
  Aurex16,
  Aurex24,
  type AurexVariant,
  type PrefixTable,
} from "aurex/server";
import type { OnKyselyQueryCallback, RuntimePlugin } from "@zenstackhq/orm";
import type { SchemaDef } from "@zenstackhq/orm/schema";

export type AurexRuntimePluginOptions = {
  models: AurexModel[];
  variant: AurexVariant;
};

function fromModelsToPrefixTable(models: AurexModel[]): PrefixTable {
  const prefixTable: PrefixTable = {};
  for (const model of models) {
    prefixTable[model.name] = model.prefix;
  }
  return prefixTable;
}

class AurexTransformer extends OperationNodeTransformer {
  aurex: Aurex16<PrefixTable> | Aurex24<PrefixTable>;

  constructor(public options: AurexRuntimePluginOptions) {
    super();

    this.aurex =
      options.variant === "A16"
        ? new Aurex16(fromModelsToPrefixTable(options.models))
        : new Aurex24(fromModelsToPrefixTable(options.models));
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

  private isIdField(modelName: string, fieldName: string): boolean {
    const model = this.options.models.find(
      (m) => m.name === modelName && m.idFields.includes(fieldName),
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

          if (!fieldName || !this.isIdField(modelName, fieldName)) {
            return value;
          }

          return this.aurex.generateForTable(modelName);
        });

        return PrimitiveValueListNode.create(transformedValues);
      }

      // Handle ValueListNode (contains a list of ValueNode)
      const transformedValues = valueList.values.map((valueNode, index) => {
        const colNode = columns[index];
        if (!colNode || !ColumnNode.is(colNode)) {
          return valueNode;
        }
        const fieldName = colNode.column.name;

        if (!this.isIdField(modelName, fieldName)) {
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
> implements RuntimePlugin<Schema> {
  transformer: AurexTransformer;

  constructor(public options: AurexRuntimePluginOptions) {
    this.transformer = new AurexTransformer(options);
  }

  get id() {
    return "zenstack-aurex-plugin";
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

// src/server.ts
import { randomBytes } from "crypto";
import { AurexCore, type AurexCoreOptions, type AurexVariant } from "./core";

export type PrefixTable = Record<string, string>;

export type ParsedAurex<TableKey extends PropertyKey = string> = {
  table: TableKey;
  prefix: string;
  entity: string;
  checksum: string;
  raw: string;
  view: string;
};

abstract class AurexBase<Table extends PrefixTable> extends AurexCore {
  readonly __tableToPrefix = new Map<keyof Table, string>();
  readonly __prefixToTable = new Map<string, keyof Table>();

  abstract variant: AurexVariant;

  constructor(prefixTable: Table, opts: AurexCoreOptions = {}) {
    super(opts);

    for (const [table, prefixRaw] of Object.entries(prefixTable) as Array<
      [keyof Table, string]
    >) {
      const prefix = this.normalize(prefixRaw);
      const prefixLen = this.prefixLength();

      if (prefix.length !== prefixLen) {
        throw new Error(
          `Aurex: prefix for table "${String(table)}" must be exactly ${prefixLen} Base32 chars.`,
        );
      }

      this.toValues(prefix);

      if (this.__tableToPrefix.has(table))
        throw new Error(`Aurex: duplicated table key "${String(table)}".`);
      if (this.__prefixToTable.has(prefix)) {
        const existing = this.__prefixToTable.get(prefix);
        throw new Error(
          `Aurex: duplicated prefix "${prefix}" for tables "${String(existing)}" and "${String(table)}".`,
        );
      }

      this.__tableToPrefix.set(table, prefix);
      this.__prefixToTable.set(prefix, table);
    }
  }

  override format(rawOrView: string): string {
    return super.format(rawOrView, this.variant);
  }

  prefixFromTable(table: keyof Table): string {
    const p = this.__tableToPrefix.get(table);
    if (!p) throw new Error(`Aurex: unknown table "${String(table)}".`);
    return p;
  }

  tableFromId(idOrView: string): keyof Table {
    const raw = this.normalize(idOrView);
    const prefixLen = this.prefixLength();
    const totalLen = this.totalLength();

    if (raw.length !== totalLen)
      throw new Error(
        `Aurex: ID must have ${totalLen} chars for ${this.variant}.`,
      );
    const prefix = raw.slice(0, prefixLen);

    const table = this.__prefixToTable.get(prefix);
    if (!table) throw new Error(`Aurex: unknown prefix "${prefix}".`);
    return table;
  }

  validate(idOrView: string): boolean {
    try {
      const raw = this.normalize(idOrView);
      const prefixLen = this.prefixLength();
      const totalLen = this.totalLength();
      if (raw.length !== totalLen) return false;

      const prefix = raw.slice(0, prefixLen);
      if (!this.__prefixToTable.has(prefix)) return false;

      return this.variant === "A16"
        ? this.validateChecksumA16(raw)
        : this.validateChecksumA24(raw);
    } catch {
      return false;
    }
  }

  parse(idOrView: string): ParsedAurex<keyof Table> {
    const raw = this.normalize(idOrView);
    const prefixLen = this.prefixLength();
    const totalLen = this.totalLength();
    const checkLen = this.checksumLength();

    if (raw.length !== totalLen)
      throw new Error(
        `Aurex: ID must have ${totalLen} chars for ${this.variant}.`,
      );
    if (!this.validate(raw)) {
      const prefix = raw.slice(0, prefixLen);
      if (!this.__prefixToTable.has(prefix))
        throw new Error(`Aurex: unknown prefix "${prefix}".`);
      throw new Error("Aurex: invalid checksum or invalid characters.");
    }

    const prefix = raw.slice(0, prefixLen);
    const table = this.__prefixToTable.get(prefix)!;
    const checksum = raw.slice(totalLen - checkLen);
    const entity = raw.slice(prefixLen, totalLen - checkLen);

    return {
      table,
      prefix,
      entity,
      checksum,
      raw,
      view: this.format(raw),
    };
  }

  /** Aurex16 => 10 bytes; Aurex24 => 15 bytes. */
  toBytes(idOrView: string): Uint8Array {
    const raw = this.normalize(idOrView);
    const totalLen = this.totalLength();
    if (raw.length !== totalLen)
      throw new Error(
        `Aurex: ID must have ${totalLen} chars for ${this.variant}.`,
      );
    if (!this.validate(raw))
      throw new Error("Aurex: invalid checksum/format or unknown prefix.");
    return this.packBase32ToBytes(raw);
  }

  fromBytes(bytes: Uint8Array, opts?: { format?: boolean }): string {
    const expectedBytes = this.byteLength();
    if (!(bytes instanceof Uint8Array))
      throw new Error("Aurex: bytes must be a Uint8Array.");
    if (bytes.length !== expectedBytes)
      throw new Error(`Aurex: bytes must have length ${expectedBytes}.`);

    const raw = this.unpackBytesToBase32(bytes, this.totalLength());
    if (!this.validate(raw))
      throw new Error(
        "Aurex: invalid checksum/format or unknown prefix (decoded).",
      );
    return opts?.format ? this.format(raw) : raw;
  }

  generateForTable(table: keyof Table): string {
    const prefix = this.prefixFromTable(table);
    const entity = this.randomEntityChars();
    const body = prefix + entity;

    const checksum =
      this.variant === "A16"
        ? this.computeLuhnCheckChar(body) // body 15
        : this.computeCrc20CheckChars(body); // body 20

    return body + checksum;
  }

  generateBytesForTable(table: keyof Table): Uint8Array {
    return this.toBytes(this.generateForTable(table));
  }

  protected prefixLength(): number {
    return 2;
  }
  protected checksumLength(): number {
    return this.variant === "A16" ? 1 : 4;
  }
  protected totalLength(): number {
    return this.variant === "A16" ? 16 : 24;
  }
  protected byteLength(): number {
    return this.variant === "A16" ? 10 : 15;
  }

  protected randomEntityChars(): string {
    const len = this.variant === "A16" ? 13 : 18;
    const bits = len * 5;
    const bytes = Math.ceil(bits / 8);
    const buf = randomBytes(bytes);

    let out = "";
    let acc = 0;
    let accBits = 0;

    for (const byte of buf) {
      acc = (acc << 8) | byte;
      accBits += 8;

      while (accBits >= 5 && out.length < len) {
        const shift = accBits - 5;
        const v = (acc >> shift) & 31;
        out += this.ALPHABET[v];
        accBits -= 5;
        acc = acc & ((1 << accBits) - 1);
      }
    }

    while (out.length < len)
      out += this.randomEntityChars().slice(0, len - out.length);
    return out;
  }
}

/** @alias Aurex */
export class Aurex16<Table extends PrefixTable> extends AurexBase<Table> {
  readonly variant = "A16" as const;
}

export class Aurex24<Table extends PrefixTable> extends AurexBase<Table> {
  readonly variant = "A24" as const;
}

export const Aurex = Aurex16;

export default Aurex;

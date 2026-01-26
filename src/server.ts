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

abstract class AurexBase<Table extends PrefixTable> {
  readonly opts: AurexCoreOptions;
  readonly __tableToPrefix = new Map<keyof Table, string>();
  readonly __prefixToTable = new Map<string, keyof Table>();

  abstract variant: AurexVariant;

  constructor(prefixTable: Table, opts: AurexCoreOptions = {}) {
    this.opts = opts;

    for (const [table, prefixRaw] of Object.entries(prefixTable) as Array<
      [keyof Table, string]
    >) {
      const prefix = AurexCore.normalize(prefixRaw, this.opts);
      const prefixLen = this.prefixLength();

      if (prefix.length !== prefixLen) {
        throw new Error(
          `Aurex: prefix for table "${String(table)}" must be exactly ${prefixLen} Base32 chars.`,
        );
      }

      AurexCore.toValues(prefix);

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

  normalize(idOrView: string): string {
    return AurexCore.normalize(idOrView, this.opts);
  }

  format(idOrView: string): string {
    return AurexCore.format(idOrView, this.variant, this.opts);
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

  /** Valida checksum + prefixo conhecido nesta instância */
  validate(idOrView: string): boolean {
    try {
      const raw = this.normalize(idOrView);
      const prefixLen = this.prefixLength();
      const totalLen = this.totalLength();
      if (raw.length !== totalLen) return false;

      const prefix = raw.slice(0, prefixLen);
      if (!this.__prefixToTable.has(prefix)) return false;

      return this.variant === "A16"
        ? AurexCore.validateChecksumA16(raw, this.opts)
        : AurexCore.validateChecksumA24(raw, this.opts);
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
    return AurexCore.packBase32ToBytes(raw);
  }

  fromBytes(bytes: Uint8Array, opts?: { format?: boolean }): string {
    const expectedBytes = this.byteLength();
    if (!(bytes instanceof Uint8Array))
      throw new Error("Aurex: bytes must be a Uint8Array.");
    if (bytes.length !== expectedBytes)
      throw new Error(`Aurex: bytes must have length ${expectedBytes}.`);

    const raw = AurexCore.unpackBytesToBase32(bytes, this.totalLength());
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
        ? AurexCore.computeLuhnCheckChar(body) // body 15
        : AurexCore.computeCrc20CheckChars(body); // body 20

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
        out += AurexCore.ALPHABET[v];
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

const Aurex = Aurex16;

export default Aurex;

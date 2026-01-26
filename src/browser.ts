import { AurexCore, type AurexCoreOptions, type AurexVariant } from "./core";

export type SanitizedInput = {
  value: string;
  cursor?: number;
  variant: AurexVariant;
  raw: string;
};

export class AurexWeb extends AurexCore {
  isPlausible(idOrView: string): boolean {
    try {
      const raw = this.normalize(idOrView);
      if (!(raw.length === 16 || raw.length === 24)) return false;
      this.toValues(raw);
      return true;
    } catch {
      return false;
    }
  }

  override format(idOrView: string): string {
    const raw = this.normalize(idOrView);
    const detected = this.detectVariant(raw);
    if (detected) return super.format(raw, detected);
    return this._formatRawPartial(raw);
  }

  sanitizeInput(
    value: string,
    cursor?: number,
    opts: AurexCoreOptions = {},
  ): SanitizedInput {
    const original = String(value);
    const rawIndexBefore =
      cursor === undefined
        ? undefined
        : this._rawCountBeforeCursor(original, cursor, opts);

    let raw = this.normalize(original);

    const allowed = new Set(this.ALPHABET.split(""));
    raw = Array.from(raw)
      .filter((ch) => allowed.has(ch))
      .join("");

    const variant: AurexVariant = raw.length > 16 ? "A24" : "A16";
    const maxLen = variant === "A16" ? 16 : 24;

    if (raw.length > maxLen) raw = raw.slice(0, maxLen);

    const formatted = this._formatRawPartial(raw);

    let newCursor: number | undefined;
    if (rawIndexBefore !== undefined) {
      const rawIndexClamped = Math.min(raw.length, rawIndexBefore);
      newCursor = this._cursorFromRawIndex(formatted, rawIndexClamped);
    }

    return { value: formatted, cursor: newCursor, variant, raw };
  }

  // ---------------- internals ----------------

  private _formatRawPartial(raw: string): string {
    const s = raw;
    if (s.length <= 4) return s;
    const parts: string[] = [];
    for (let i = 0; i < s.length; i += 4) parts.push(s.slice(i, i + 4));
    return parts.join("-");
  }

  private _rawCountBeforeCursor(
    original: string,
    cursor: number,
    opts: AurexCoreOptions,
  ): number {
    const before = original.slice(0, Math.max(0, cursor));
    const normalized = this.normalize(before);

    const allowed = new Set(this.ALPHABET.split(""));
    return Array.from(normalized).filter((ch) => allowed.has(ch)).length;
  }

  private _cursorFromRawIndex(formatted: string, rawIndex: number): number {
    if (rawIndex <= 0) return 0;

    let rawSeen = 0;
    for (let i = 0; i < formatted.length; i++) {
      const ch = formatted[i];
      if (ch === "-") continue;
      rawSeen++;
      if (rawSeen >= rawIndex) return i + 1;
    }
    return formatted.length;
  }
}

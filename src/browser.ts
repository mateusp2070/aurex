// src/web.ts
// Build "browser": utilitários mínimos para UX e validação sem prefix table.
import { AurexCore, type AurexCoreOptions, type AurexVariant } from "./core";

export type SanitizedInput = {
  /** Valor formatado (blocos de 4 com hífen) */
  value: string;
  /** Cursor ajustado (quando fornecido) */
  cursor?: number;
  /** Variante inferida a partir do tamanho (quando possível) */
  variant: AurexVariant;
  /** Valor normalizado (sem hífen/espaço, uppercase, Crockford) */
  raw: string;
};

export class AurexWeb {
  static normalize(idOrView: string, opts: AurexCoreOptions = {}): string {
    return AurexCore.normalize(idOrView, opts);
  }

  static detectVariant(
    idOrView: string,
    opts: AurexCoreOptions = {},
  ): AurexVariant | null {
    return AurexCore.detectVariant(idOrView, opts);
  }

  /**
   * Validação barata (boa para onInput):
   * - tamanho 16 ou 24 (após normalização)
   * - charset Base32 Crockford (após normalização)
   * Não valida checksum.
   */
  static isPlausible(idOrView: string, opts: AurexCoreOptions = {}): boolean {
    try {
      const raw = AurexCore.normalize(idOrView, opts);
      if (!(raw.length === 16 || raw.length === 24)) return false;
      AurexCore.toValues(raw);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Formata em blocos de 4 com hífen.
   * - Se a variante for detectável (16/24), usa a variante correta.
   * - Se ainda estiver em digitação (tamanho parcial), formata parcial em blocos de 4.
   */
  static format(idOrView: string, opts: AurexCoreOptions = {}): string {
    const raw = AurexCore.normalize(idOrView, opts);
    const detected = AurexCore.detectVariant(raw, opts);
    if (detected) return AurexCore.format(raw, detected, opts);
    return AurexWeb._formatRawPartial(raw);
  }

  /** Valida apenas checksum (Aurex16 ou Aurex24), com normalização Crockford opcional. */
  static validateChecksum(
    idOrView: string,
    opts: AurexCoreOptions = {},
  ): boolean {
    return AurexCore.validateChecksum(idOrView, opts);
  }

  /**
   * Sanitiza e formata um input de texto para uso em campo de formulário.
   * - Remove hífens/espaços
   * - Uppercase + normalização Crockford (O→0, I/L→1)
   * - Remove caracteres fora do alfabeto Base32 Crockford
   * - Reinsere hífens em blocos de 4 (A16: 4 grupos; A24: 6 grupos)
   *
   * cursor (opcional): índice do cursor no texto original. Retorna cursor ajustado.
   */
  static sanitizeInput(
    value: string,
    cursor?: number,
    opts: AurexCoreOptions = {},
  ): SanitizedInput {
    const original = String(value);
    const rawIndexBefore =
      cursor === undefined
        ? undefined
        : AurexWeb._rawCountBeforeCursor(original, cursor, opts);

    // 1) Normaliza (remove separadores, uppercase, Crockford)
    let raw = AurexCore.normalize(original, opts);

    // 2) Filtra para alfabeto permitido (UX-friendly; não dá throw)
    const allowed = new Set(AurexCore.ALPHABET.split(""));
    raw = Array.from(raw)
      .filter((ch) => allowed.has(ch))
      .join("");

    // 3) Variante inferida durante digitação
    const variant: AurexVariant = raw.length > 16 ? "A24" : "A16";
    const maxLen = variant === "A16" ? 16 : 24;

    // 4) Trunca ao máximo
    if (raw.length > maxLen) raw = raw.slice(0, maxLen);

    // 5) Formata parcial em blocos de 4
    const formatted = AurexWeb._formatRawPartial(raw);

    // 6) Cursor ajustado
    let newCursor: number | undefined;
    if (rawIndexBefore !== undefined) {
      const rawIndexClamped = Math.min(raw.length, rawIndexBefore);
      newCursor = AurexWeb._cursorFromRawIndex(formatted, rawIndexClamped);
    }

    return { value: formatted, cursor: newCursor, variant, raw };
  }

  // ---------------- internals ----------------

  private static _formatRawPartial(raw: string): string {
    const s = raw;
    if (s.length <= 4) return s;
    const parts: string[] = [];
    for (let i = 0; i < s.length; i += 4) parts.push(s.slice(i, i + 4));
    return parts.join("-");
  }

  /** Conta quantos caracteres "raw" existem antes do cursor no texto original. */
  private static _rawCountBeforeCursor(
    original: string,
    cursor: number,
    opts: AurexCoreOptions,
  ): number {
    const before = original.slice(0, Math.max(0, cursor));
    const normalized = AurexCore.normalize(before, opts);

    // Filtra para o alfabeto permitido (igual sanitize)
    const allowed = new Set(AurexCore.ALPHABET.split(""));
    return Array.from(normalized).filter((ch) => allowed.has(ch)).length;
  }

  /** Converte um índice "raw" (sem hífen) para índice em string formatada (com hífen). */
  private static _cursorFromRawIndex(
    formatted: string,
    rawIndex: number,
  ): number {
    if (rawIndex <= 0) return 0;

    let rawSeen = 0;
    for (let i = 0; i < formatted.length; i++) {
      const ch = formatted[i];
      if (ch === "-") continue;
      rawSeen++;
      if (rawSeen >= rawIndex) return i + 1; // cursor após este caractere
    }
    return formatted.length;
  }
}

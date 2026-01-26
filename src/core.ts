import { enumerate } from "./helpers";

export type AurexVariant = "A16" | "A24";

export type AurexCoreOptions = {
  /**
   * (O→0, I/L→1)
   *
   * @default true
   */
  humanNormalize?: boolean;
};

export class AurexCore {
  readonly ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  readonly BASE = 32;

  constructor(public readonly opts: AurexCoreOptions = {}) {}

  readonly CHAR_TO_VAL: Record<string, number> = (() => {
    const map: Record<string, number> = {};

    for (const [char, index] of enumerate(this.ALPHABET)) map[char] = index;

    return map;
  })();

  normalize(input: string): string {
    const raw = String(input).replace(/[-\s]/g, "");
    let up = raw.toUpperCase();
    const human = this.opts.humanNormalize !== false;
    if (human) up = up.replaceAll(/O/g, "0").replaceAll(/[IL]/g, "1");
    return up;
  }

  format(rawOrView: string, variant: AurexVariant): string {
    const s = this.normalize(rawOrView);
    const len = variant === "A16" ? 16 : 24;
    if (s.length !== len)
      throw new Error(
        `Aurex: ID must have ${len} Base32 characters for ${variant}.`,
      );
    const parts: string[] = [];
    for (let i = 0; i < s.length; i += 4) parts.push(s.slice(i, i + 4));
    return parts.join("-");
  }

  toValues(s: string): number[] {
    const vals: number[] = [];
    for (const ch of s) {
      const v = this.CHAR_TO_VAL[ch];
      if (v === undefined) throw new Error(`Aurex: invalid character "${ch}".`);
      vals.push(v);
    }
    return vals;
  }

  // ---------------- Luhn mod 32 (A16) ----------------

  luhnModNCheckValue(values: number[]): number {
    const base = this.BASE;
    let sum = 0;
    let doubleIt = true;
    for (let value of values.toReversed()) {
      if (doubleIt) {
        const d = value * 2;
        value = Math.floor(d / base) + (d % base);
      }
      sum += value;
      doubleIt = !doubleIt;
    }
    return (base - (sum % base)) % base;
  }

  computeLuhnCheckChar(body15: string): string {
    if (body15.length !== 15)
      throw new Error("Aurex16: body must have 15 characters.");
    const vals = this.toValues(body15);
    const checkVal = this.luhnModNCheckValue(vals);
    return this.ALPHABET[checkVal]!;
  }

  validateChecksumA16(rawOrView: string): boolean {
    try {
      const s = this.normalize(rawOrView);
      if (s.length !== 16) return false;
      const body = s.slice(0, 15);
      const check = s.slice(15);
      const expected = this.computeLuhnCheckChar(body);
      return expected === check;
    } catch {
      return false;
    }
  }

  // ---------------- CRC-20 (A24) ----------------
  // CRC-20/CDMA2000:
  // width: 20, poly: 0xC1ACF, init: 0xFFFFF, refin/refout: false, xorout: 0x00000

  crc20(bytes: Uint8Array): number {
    const width = 20;
    const poly = 0xc1acf;
    let crc = 0xfffff;
    const topBit = 1 << (width - 1);
    const mask = (1 << width) - 1;

    for (const b of bytes) {
      crc ^= (b << (width - 8)) & mask;
      for (let i = 0; i < 8; i++) {
        const bit = (crc & topBit) !== 0;
        crc = (crc << 1) & mask;
        if (bit) crc ^= poly;
      }
    }
    return crc & mask;
  }

  encodeBase32Bits(value: number, chars: number): string {
    let out = "";
    for (let i = chars - 1; i >= 0; i--) {
      const shift = i * 5;
      const v = (value >> shift) & 31;
      out += this.ALPHABET[v];
    }
    return out;
  }

  computeCrc20CheckChars(body20: string): string {
    if (body20.length !== 20)
      throw new Error("Aurex24: body must have 20 characters.");
    const bytes = this.packBase32ToBytes(body20);
    const crc = this.crc20(bytes);
    return this.encodeBase32Bits(crc, 4);
  }

  validateChecksumA24(rawOrView: string): boolean {
    try {
      const s = this.normalize(rawOrView);
      if (s.length !== 24) return false;
      const body = s.slice(0, 20);
      const check = s.slice(20, 24);
      const expected = this.computeCrc20CheckChars(body);
      return expected === check;
    } catch {
      return false;
    }
  }

  detectVariant(rawOrView: string): AurexVariant | null {
    const s = this.normalize(rawOrView);
    if (s.length === 16) return "A16";
    if (s.length === 24) return "A24";
    return null;
  }

  /** Único método pensado para exposição no browser build. */
  validateChecksum(rawOrView: string): boolean {
    const v = this.detectVariant(rawOrView);
    if (!v) return false;
    return v === "A16"
      ? this.validateChecksumA16(rawOrView)
      : this.validateChecksumA24(rawOrView);
  }

  // ---------------- Bit packing helpers  ----------------

  packBase32ToBytes(raw: string): Uint8Array {
    const vals = this.toValues(raw);
    const totalBits = vals.length * 5;
    const out = new Uint8Array(Math.ceil(totalBits / 8));

    let bitBuffer = 0;
    let bitCount = 0;
    let byteIndex = 0;

    for (const v of vals) {
      bitBuffer = (bitBuffer << 5) | v;
      bitCount += 5;

      while (bitCount >= 8) {
        const shift = bitCount - 8;
        out[byteIndex++] = (bitBuffer >> shift) & 0xff;
        bitCount -= 8;
        bitBuffer &= (1 << bitCount) - 1;
      }
    }

    if (bitCount > 0) {
      out[byteIndex++] = (bitBuffer << (8 - bitCount)) & 0xff;
    }

    return out;
  }

  unpackBytesToBase32(bytes: Uint8Array, chars: number): string {
    let bitBuffer = 0;
    let bitCount = 0;
    let out = "";

    for (const b of bytes) {
      bitBuffer = (bitBuffer << 8) | b;
      bitCount += 8;

      while (bitCount >= 5 && out.length < chars) {
        const shift = bitCount - 5;
        const v = (bitBuffer >> shift) & 31;
        out += this.ALPHABET[v];
        bitCount -= 5;
        bitBuffer &= (1 << bitCount) - 1;
      }
    }

    if (out.length !== chars)
      throw new Error("Aurex: unpack internal error (wrong length).");
    return out;
  }
}

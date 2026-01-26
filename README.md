# Aurex

![Aurex Logo](./logo.png)

> Status: Proof of Concept v2

![Entropy](https://img.shields.io/badge/entropy-65--90%20bits-blue)
![Checksum](https://img.shields.io/badge/checksum-Luhn%20%7C%20CRC--20-green)
![Base32](https://img.shields.io/badge/base32-Crockford-black)

**Aurex** is a family of compact, human-readable, and verifiable
identifiers designed for transactional systems and physical printing
(Data Matrix). It provides embedded namespace support and checksum
validation to reduce human error.

Identifiers are encoded using **Base32 Crockford**, prioritizing human
readability and binary efficiency.

---

# Why Aurex?

Most systems default to UUIDs.

UUIDs are excellent for distributed uniqueness, but:

- They are hard to read.
- Easy to mistype.
- Have no built-in validation.
- Are verbose for printing.
- Do not embed namespace information.

Aurex is designed for systems where **humans actually interact with
IDs** --- typing them, copying them, scanning them, or printing them on
labels.

It trades some entropy for:

- Better ergonomics
- Built-in validation
- Smaller footprint
- Clear namespace boundaries

---

# Variants

## Aurex16 (default)

Alias: `Aurex`

### Structure

PP + EEEEEEEEEEEEE + C

- 16 Base32 characters\
- PP → 2-character prefix (namespace/table)\
- E → 13 random characters (65 bits)\
- C → 1 checksum character (Luhn mod 32)

### Entropy

13 chars × 5 bits = 65 bits\
2\^65 ≈ 3.69 × 10\^19 combinations per namespace

### Display Format

XXXX-XXXX-XXXX-XXXX

Persistence: stored without hyphens

---

## Aurex24 (high robustness)

### Structure

PP + EEEEEEEEEEEEEEEEEE + CCCC

- 24 Base32 characters\
- PP → 2-character prefix\
- E → 18 random characters (90 bits)\
- CCCC → 4 checksum characters (CRC-20, 20 bits)

### Entropy

18 chars × 5 bits = 90 bits\
2\^90 ≈ 1.23 × 10\^27 combinations per namespace

### Display Format

XXXX-XXXX-XXXX-XXXX-XXXX-XXXX

Persistence: stored without hyphens

---

# Comparison with UUID

| Feature               | Aurex16   | Aurex24   | UUID v4  |
| --------------------- | --------- | --------- | -------- |
| Random bits           | 65        | 90        | 122      |
| Text length           | 16 chars  | 24 chars  | 36 chars |
| Binary size           | 10 bytes  | 15 bytes  | 16 bytes |
| Embedded namespace    | Yes       | Yes       | No       |
| Human readability     | High      | High      | Low      |
| Checksum              | Yes       | Yes       | No       |
| Ideal for Data Matrix | Excellent | Excellent | Moderate |

---

# Collision Mathematics

P ≈ 1 - exp( - n² / (2N) )

Where:

- n = number of generated IDs\
- N = total space (2\^bits)

---

## Aurex16 (65 bits)

N = 2\^65 ≈ 3.69 × 10\^19

| IDs generated | Collision probability |
| ------------- | --------------------- |
| 1 million     | \~ 1.35e-8            |
| 10 million    | \~ 1.35e-6            |
| 100 million   | \~ 1.35e-4            |
| \~860 million | \~1%                  |
| \~2.7 billion | \~10%                 |

---

## Aurex24 (90 bits)

N = 2\^90 ≈ 1.23 × 10\^27

| IDs generated | Collision probability |
| ------------- | --------------------- |
| 1 billion     | \~ 4e-10              |
| 10 billion    | \~ 4e-8               |
| \~5 trillion  | \~1%                  |
| \~16 trillion | \~10%                 |

---

# Implementation Examples

## Server (Node)

```ts
import { Aurex, Aurex24 } from "aurex";

const a16 = new Aurex({
  users: "U1",
  patients: "P2",
});

const id16 = a16.generateForTable("users");

console.log(a16.format(id16));
console.log(a16.validate(id16));
```

## Web (Browser)

```ts
import { AurexWeb } from "aurex";

const aurex = new AurexWeb();

aurex.isPlausible(id);
aurex.validateChecksum(id);
aurex.format(id);
```

## Web Input Mask Example

```ts
import { AurexWeb } from "aurex";

const aurex = new AurexWeb();

function onInput(e: InputEvent) {
  const el = e.target as HTMLInputElement;
  const caret = el.selectionStart ?? el.value.length;

  const out = aurex.sanitizeInput(el.value, caret);

  el.value = out.value;

  if (out.cursor !== undefined) {
    el.setSelectionRange(out.cursor, out.cursor);
  }

  const complete = out.raw.length === 16 || out.raw.length === 24;
  const ok = complete ? AurexWeb.validateChecksum(out.raw) : true;
}
```

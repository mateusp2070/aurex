# ZenStack Aurex Plugin

Deterministic, namespace-aware Aurex ID generation for ZenStack v3.

This plugin integrates [**Aurex**](https://github.com/mateusp2070/aurex) as the default ID strategy for your
ZenStack models, generating compact, human-readable, checksum-protected
identifiers with embedded namespace support.

---

## Overview

This plugin:

- Automatically injects Aurex IDs into **all models**
- Generates deterministic prefix mappings per model
- Produces a manifest file (prefix contract)
- Enforces collision-safe prefix inference
- Uses a single global variant (Aurex16 or Aurex24)

No per-model configuration is required.

---

## Installation

```bash
npm install zenstack-aurex-plugin
```

---

## Usage

### 1️⃣ Configure the plugin in your `schema.zmodel`

```prisma
plugin aurex {
  provider = "zenstack-aurex-plugin"

  variant = "A16"              // A16 or A24 (default: A16)

  output  = "../src/generated"

  updateManifest = false      // Not implemented yet (v0.0.1)
}
```

---

### 2️⃣ Define your models

Use the helper type:

```prisma
model User with Aurex {
  // Other fields
}
```

> `type Aurex` is a helper type that expands to a compatible
> `id String @id @db.VarChar(24) @default(dbgenerated("#placeholder#"))` field.

---

## Important Behavior

### ✅ All models are injected

Every model will automatically:

- Receive a deterministic prefix
- Be included in the manifest
- Use the configured global variant

You do **not** need `@@aurex` for basic usage.

---

## Optional: Model-Level Configuration

You may override the inferred prefix:

```prisma
model User with Aurex {
  // ...

  @@aurex(prefix: "US")
}
```

`@@aurex` is **optional**.

If omitted, the prefix will be inferred using model name hashing.

---

## Manifest File

The plugin generates a contract file:

```ts
const manifest = {
  "variant": "A16",
  "models": [
    {
        idFields: ["id"];
        name: "User";
        prefix: "FA";
    }
  ]
} as const;
export default manifest;
```

This file ensures:

- Stable prefix assignments
- Reproducible builds
- Explicit breaking changes (Not implemented yet (v0.0.1))

(Not implemented yet (v0.0.1)) If a prefix changes and `updateManifest = false`, generation fails.

To approve changes:

```prisma
updateManifest = true // Not implemented yet (v0.0.1)
```

---

## Runtime Integration

In your application:

```ts
import manifest from "../aurex-manifest.ts";
import { AurexPlugin } from "zenstack-aurex-plugin";

db.$use(new AurexPlugin(manifest));
```

The runtime plugin:

- Injects Aurex IDs during `create`
- (Not implemented yet) Optionally validates provided IDs
- (Not implemented yet) Ensures checksum correctness

---

## Variant

Variant is global:

```prisma
variant = "A16"
```

Available options:

- `A16` → Aurex16 (65 bits entropy, Luhn checksum)
- `A24` → Aurex24 (90 bits entropy, CRC-20 checksum)

Per-model variants are intentionally not supported.

---

## Design Goals

- Compact identifiers
- Human-readable
- Embedded namespace
- Built-in checksum
- Deterministic prefix mapping
- Versioned prefix contract
- Safe schema evolution

---

## Error Conditions

The plugin fails generation if:

- Prefix collision detected
- (Not implemented yet (v0.0.1)) Manifest changes without approval
- Invalid variant is provided
- Invalid prefix override is declared

All failures are explicit and intentional.

---

## Why Aurex?

Aurex is a structured alternative to UUID for systems where humans
interact with identifiers.

It provides:

- Smaller printable footprint
- Checksum validation
- Namespace awareness
- Deterministic formatting

---

## License

MIT

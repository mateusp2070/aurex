# Aurex Specification (SPEC)

Version: 1.0\
Status: Stable

------------------------------------------------------------------------

# 1. Overview

Aurex is a compact, namespace-aware, human-readable identifier format
based on Base32 Crockford encoding. It provides:

-   Embedded namespace (prefix)
-   Strong entropy guarantees
-   Built-in checksum validation
-   Efficient binary representation
-   Optimized human transcription safety

Two variants are defined:

-   Aurex16 (default)
-   Aurex24 (extended robustness)

------------------------------------------------------------------------

# 2. Character Set

Aurex uses Base32 Crockford alphabet:

    0123456789ABCDEFGHJKMNPQRSTVWXYZ

Normalization rules:

-   O → 0
-   I → 1
-   L → 1
-   Case insensitive
-   Hyphens and spaces ignored for parsing

------------------------------------------------------------------------

# 3. Aurex16

## 3.1 Structure

    PP EEEEEEEEEEEEE C

Total length: 16 characters.

  Segment   |Length   |Description
  --------- |-------- |--------------------------
  PP        |2        |Namespace prefix
  E         |13       |Random payload (65 bits)
  C         |1        |Checksum (Luhn mod 32)

## 3.2 Entropy

13 chars × 5 bits = 65 bits\
Namespace space: 2\^65 per prefix

## 3.3 Checksum

Algorithm: Luhn mod 32

Detects: - Single character errors - Adjacent transpositions

------------------------------------------------------------------------

# 4. Aurex24

## 4.1 Structure

    PP EEEEEEEEEEEEEEEEEE CCCC

Total length: 24 characters.

  Segment   |Length   |Description
  --------- |-------- |--------------------------
  PP        |2        |Namespace prefix
  E         |18       |Random payload (90 bits)
  C         |4        |Checksum (CRC-20)

## 4.2 Entropy

18 chars × 5 bits = 90 bits\
Namespace space: 2\^90 per prefix

## 4.3 Checksum

Algorithm: CRC-20/CDMA2000

Parameters:

-   width: 20
-   polynomial: 0xC1ACF
-   init: 0xFFFFF
-   refin: false
-   refout: false
-   xorout: 0x00000

Checksum is computed over the first 20 characters (100 bits) and encoded
into 4 Base32 characters.

------------------------------------------------------------------------

# 5. Formatting

Human-readable format uses groups of 4 characters separated by hyphens.

Aurex16:

    XXXX-XXXX-XXXX-XXXX

Aurex24:

    XXXX-XXXX-XXXX-XXXX-XXXX-XXXX

Hyphens are not part of canonical representation.

------------------------------------------------------------------------

# 6. Binary Encoding

Each Base32 character represents 5 bits.

  Variant   |Bits   |Bytes
  --------- |------ |-------
  Aurex16   |80     |10
  Aurex24   |120    |15

Binary encoding packs consecutive 5-bit values into byte-aligned
buffers.

------------------------------------------------------------------------

# 7. Collision Probability

Approximation formula (Birthday paradox):

    P ≈ 1 − exp( −n² / (2N) )

Where:

-   n = number of generated IDs
-   N = 2\^bits

Example:

Aurex16 (65 bits):

-   \~860M IDs → \~1% collision probability
-   \~2.7B IDs → \~10% collision probability

Aurex24 (90 bits):

-   \~5T IDs → \~1%
-   \~16T IDs → \~10%

------------------------------------------------------------------------

# 8. Security Considerations

-   Prefix does not provide authorization.
-   ID secrecy is not assumed.
-   Entropy relies solely on random payload.
-   Aurex is not a cryptographic identifier.
-   Authorization must be enforced server-side.

------------------------------------------------------------------------

# 9. Intended Use Cases

Aurex16: - Human-facing identifiers - Moderate-scale systems - Data
Matrix / QR compression

Aurex24: - High-volume systems - Optical scanning environments - Higher
corruption resistance requirements

------------------------------------------------------------------------

# 10. Versioning

Future variants must:

-   Preserve Base32 alphabet
-   Clearly specify checksum algorithm
-   Maintain canonical no-hyphen storage format

End of specification.


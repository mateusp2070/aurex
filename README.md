# Aurex

![Aurex Logo](./logo.png)

> Status: prova de conceito v2

![Entropy](https://img.shields.io/badge/entropy-65--90%20bits-blue)
![Checksum](https://img.shields.io/badge/checksum-Luhn%20%7C%20CRC--20-green)
![Base32](https://img.shields.io/badge/base32-Crockford-black)

**Aurex** é uma família de identificadores compactos, legíveis e
verificáveis, projetados para sistemas transacionais e impressão (Data
Matrix), com namespace embutido e checksum para reduzir erro humano.

Os IDs utilizam Base32 Crockford, priorizando legibilidade humana e
eficiência binária.

------------------------------------------------------------------------

# Variantes

## Aurex16 (default)

Alias: `Aurex`

### Estrutura

PP + EEEEEEEEEEEEE + C

-   16 caracteres Base32
-   PP → 2 chars de prefixo (namespace/tabela)
-   E → 13 chars aleatórios (65 bits)
-   C → 1 char checksum (Luhn mod 32)

### Entropia

13 chars × 5 bits = 65 bits\
2\^65 ≈ 3.69 × 10\^19 combinações por namespace

### Exibição

XXXX-XXXX-XXXX-XXXX

Persistência: sem hífen

------------------------------------------------------------------------

## Aurex24 (alta robustez)

### Estrutura

PP + EEEEEEEEEEEEEEEEEE + CCCC

-   24 caracteres Base32
-   PP → 2 chars prefixo
-   E → 18 chars aleatórios (90 bits)
-   CCCC → 4 chars checksum (CRC-20, 20 bits)

### Entropia

18 chars × 5 bits = 90 bits\
2\^90 ≈ 1.23 × 10\^27 combinações por namespace

### Exibição

XXXX-XXXX-XXXX-XXXX-XXXX-XXXX

Persistência: sem hífen

------------------------------------------------------------------------

# Comparação com UUID

  Característica           |Aurex16     |Aurex24    |UUID v4
  ------------------------ |----------- |-----------|----------
  Bits aleatórios          | 65         | 90        | 122
  Tamanho texto            | 16 chars   | 24 chars  | 36 chars
  Tamanho binário          | 10 bytes   | 15 bytes  | 16 bytes
  Namespace embutido       | Sim        | Sim       | Não
  Legibilidade humana      | Alta       | Alta      | Baixa
  Checksum                 | Sim        | Sim       | Não
  Ideal para Data Matrix   | Excelente  | Excelente | Médio

------------------------------------------------------------------------

# Matemática de Colisão

P ≈ 1 - exp( - n² / (2N) )

Onde: - n = quantidade de IDs gerados - N = espaço total (2\^bits)

## Aurex16 (65 bits)

N = 2\^65 ≈ 3.69 × 10\^19

  n gerados       | Probabilidade
  --------------- | ---------------
  1 milhão        | \~ 1.35e-8
  10 milhões      | \~ 1.35e-6
  100 milhões     | \~ 1.35e-4
  \~860 milhões   | \~1%
  \~2.7 bilhões   | \~10%

## Aurex24 (90 bits)

N = 2\^90 ≈ 1.23 × 10\^27

  n gerados       |Probabilidade
  --------------- |---------------
  1 bilhão        |\~ 4e-10
  10 bilhões      |\~ 4e-8
  \~5 trilhões    |\~1%
  \~16 trilhões   |\~10%

------------------------------------------------------------------------

# Exemplos de Implementação

## Server (Node)

``` ts
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

``` ts
import { AurexWeb } from "aurex";

AurexWeb.isPlausible(id);
AurexWeb.validateChecksum(id);
AurexWeb.format(id);
```

### Web Input Mask

```ts
function onInput(e: InputEvent) {
  const el = e.target as HTMLInputElement;
  const caret = el.selectionStart ?? el.value.length;

  const out = AurexWeb.sanitizeInput(el.value, caret);

  el.value = out.value;
  if (out.cursor !== undefined)
    el.setSelectionRange(out.cursor, out.cursor);

  const complete = out.raw.length === 16 || out.raw.length === 24;
  const ok = complete ? AurexWeb.validateChecksum(out.raw) : true;
}
```

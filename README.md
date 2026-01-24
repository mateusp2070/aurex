# Aurex

> Status: Prova de conceito.

**Aurex** é um identificador compacto, legível e verificável, projetado para uso em sistemas transacionais e impressão (Data Matrix), com **checksum** para reduzir erro humano.

- **Formato lógico (persistido)**: `TTEEEEEEEEEEEEEC` (16 chars, Base32 Crockford)
- **Formato de exibição (apenas visual)**: `TTEE-EEEE-EEEE-EEEC`
- **Estrutura**:
  - `TT` (2 chars) → namespace / tabela (Base32 Crockford)
  - `EEEEEEEEEEEEE` (13 chars) → entidade (Base32 Crockford, **65 bits**)
  - `C` (1 char) → checksum (**Luhn mod 32**)

> Observação: os hífens não fazem parte do ID. No banco, grave sempre **sem hífen**.

---

## Por que Aurex

- **Baixa probabilidade de colisão**: 13 chars Base32 = 65 bits (2^65 possibilidades por tabela)
- **Legibilidade humana**: Base32 Crockford evita caracteres ambíguos (O/0, I/1, L/1)
- **Compacto**: 16 chars, ideal para Data Matrix e campos curtos
- **Checksum**: Luhn mod 32 detecta erros comuns de digitação e transposição adjacente

---

## Instalação

Aurex está disponível no NPM.

---

## Uso

```ts
import { Aurex } from "aurex";

const aurex = new Aurex({
  users: "A7",
  patients: "P2",
  invoices: "F0",
});

// gerar para uma tabela
const id = aurex.generateForTable("users");  // ex: "A7F3K9X2Q4M8T6C1"

// exibir para humanos
const view = aurex.format(id);               // "A7F3-K9X2-Q4M8-T6C1"

// aceitar input humano com/sem hífen
const normalized = aurex.normalize(view);    // "A7F3K9X2Q4M8T6C1"

// validar (charset + checksum + prefixo conhecido)
const ok = aurex.validate(id);               // true

// parse com resolução de tabela
const parsed = aurex.parse(id);
/*
{
  table: "users",
  prefix: "A7",
  entity: "F3K9X2Q4M8T6C",
  checksum: "1",
  raw: "A7F3K9X2Q4M8T6C1",
  view: "A7F3-K9X2-Q4M8-T6C1"
}
*/
```

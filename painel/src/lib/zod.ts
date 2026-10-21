import {
  boolean,
  config,
  minLength,
  nullish,
  number,
  object,
  optional,
  string,
  trim,
  union,
  type output,
} from "zod/mini";

// zod/mini (API funcional) com imports pontuais: o reexport do namespace inteiro levava o gerador
// de JSON Schema e as locales para o primeiro carregamento do login (ressalva 1 da revisão do
// WN-0, medido no analisador do Turbopack). Para usar outra peça do zod, importe-a aqui.
//
// Sem o JIT: ele testa `new Function("")`, e a CSP `script-src 'self'` (sem 'unsafe-eval') reporta
// isso como `securitypolicyviolation`, mesmo com o erro engolido. Todo o painel importa o zod daqui
// (regra de lint).
config({ jitless: true });

export const z = { boolean, minLength, nullish, number, object, optional, string, trim, union } as const;

/** Tipo de saída de um schema (o `z.infer` do zod). */
export type Infer<T> = output<T>;

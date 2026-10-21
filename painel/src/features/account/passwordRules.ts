/** Regras de senha da API (`UserEntity.PASSWORD_RULES`), as mesmas do app (`password_rules.dart`). */
export interface PasswordRule {
  readonly label: string;
  readonly errorText: string;
  readonly isSatisfied: (password: string) => boolean;
}

export const MIN_LENGTH = 8;
export const MAX_LENGTH = 20;

/** Como o `[^\w\s]` do Python: letra acentuada conta como letra, não como caractere especial. */
const SPECIAL = /[^\p{L}\p{N}_\s]/u;

export const PASSWORD_RULES: readonly PasswordRule[] = [
  { label: `De ${MIN_LENGTH} a ${MAX_LENGTH} caracteres`, errorText: `Deve ter de ${MIN_LENGTH} a ${MAX_LENGTH} caracteres`, isSatisfied: (p) => p.length >= MIN_LENGTH && p.length <= MAX_LENGTH },
  { label: "Uma letra maiúscula", errorText: "Deve conter pelo menos uma letra maiúscula", isSatisfied: (p) => /[A-Z]/.test(p) },
  { label: "Uma letra minúscula", errorText: "Deve conter pelo menos uma letra minúscula", isSatisfied: (p) => /[a-z]/.test(p) },
  { label: "Um número", errorText: "Deve conter pelo menos um número", isSatisfied: (p) => /\d/.test(p) },
  { label: "Um caractere especial", errorText: "Deve conter pelo menos um caractere especial", isSatisfied: (p) => SPECIAL.test(p) },
];

/** Texto da primeira regra que a senha não cumpre, ou `null`. */
export function firstPasswordError(password: string): string | null {
  return PASSWORD_RULES.find((rule) => !rule.isSatisfied(password))?.errorText ?? null;
}

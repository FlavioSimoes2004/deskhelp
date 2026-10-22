/** Nome de categoria como é gravado: sem espaços sobrando e em maiúsculas (com acentos: "SEGURANÇA"). */
export const normalizeCategoryName = (name: string) => name.trim().replace(/\s+/g, " ").toLocaleUpperCase("pt-BR");

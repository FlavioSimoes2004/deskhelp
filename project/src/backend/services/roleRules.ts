import type { Role } from "../models/types.js";

/**
 * O que cada perfil pode, num lugar só:
 * - super_support: acesso total (atende, gerencia usuários sem restrição, Administração, Super support);
 * - support: atende chamados (com as regras do suporte) e gerencia usuários comuns/suporte;
 * - admin: vê todos os chamados, mas sem atender (regras do comum) + páginas de Administração;
 * - comum: abre e acompanha os próprios chamados.
 */

/** Acesso total, sem as restrições do suporte. */
export const isSuper = (role: Role) => role === "super_support";

/** Equipe de atendimento: vê todos os chamados, pode ser responsável, escreve notas internas. */
export const isStaff = (role: Role) => role === "support" || role === "super_support";

/** Vê todos os chamados (a equipe e o admin; o admin só lê, não atende). */
export const canViewAllTickets = (role: Role) => isStaff(role) || role === "admin";

/** Páginas de Administração (relatórios e Configurações). */
export const canAdministrate = (role: Role) => role === "admin" || role === "super_support";

/** Sem atendimento, com as regras do usuário comum (o admin, porém, vê todos os chamados). */
export const isRequesterOnly = (role: Role) => role === "comum" || role === "admin";

/** Perfis que o suporte não cria, não promove e não edita. */
export const isProtectedRole = (role: Role) => role === "admin" || role === "super_support";

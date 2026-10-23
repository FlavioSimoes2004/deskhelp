import * as categories from "../models/categoryModel.js";
import { HttpError, notFound } from "../utils/httpError.js";
import { normalizeCategoryName } from "./categoryRules.js";

export const listCategories = categories.listCategories;

/** Cadastra a categoria em maiúsculas; recusa nome repetido (sem diferenciar maiúsculas nem acentos). */
export async function createCategory(rawName: string) {
  const name = normalizeCategoryName(rawName);
  if (await categories.findCategoryByName(name)) {
    const message = "Já existe uma categoria com este nome";
    throw new HttpError(409, "CATEGORY_EXISTS", message, [{ field: "name", message }]);
  }
  const id = await categories.insertCategory(name);
  return { id, name, active: true };
}

/** Ativa ou desativa a categoria para escolha nos chamados. */
export async function setActive(id: number, active: boolean) {
  if (!(await categories.setCategoryActive(id, active))) throw notFound("Categoria não encontrada");
  return categories.findCategoryById(id);
}

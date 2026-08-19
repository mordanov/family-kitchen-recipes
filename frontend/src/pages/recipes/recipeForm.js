export const defaultRecipeForm = {
  id: '',
  title: '',
  cooking_method: '',
  servings: 4,
  active_cooking_time_minutes: '',
  cooking_time_minutes: '',
  ingredients: '',
  recipe: '',
  shopping_list: '',
  extra_info: '',
  freezer_friendly: false,
  is_dietary: false,
  categories: [],
  imageFile: null,
  imageUrl: '',
  materialFile: null,
  imagePreview: '',
  additionalMaterialName: '',
}

export function buildRecipeFormData(form) {
  const fd = new FormData()
  fd.append('title', form.title.trim())
  form.categories.forEach((categoryId) => fd.append('categories', categoryId))
  fd.append('ingredients', form.ingredients.trim())
  fd.append('recipe', form.recipe.trim())
  fd.append('shopping_list', form.shopping_list.trim() || form.ingredients.trim())
  if (form.cooking_method) fd.append('cooking_method', form.cooking_method)
  fd.append('servings', String(form.servings))
  if (String(form.active_cooking_time_minutes).trim()) {
    fd.append('active_cooking_time_minutes', String(form.active_cooking_time_minutes).trim())
  }
  if (String(form.cooking_time_minutes).trim()) {
    fd.append('cooking_time_minutes', String(form.cooking_time_minutes).trim())
  }
  fd.append('freezer_friendly', String(Boolean(form.freezer_friendly)))
  fd.append('is_dietary', String(Boolean(form.is_dietary)))
  fd.append('extra_info', form.extra_info || '')
  if (form.imageFile) {
    fd.append('image', form.imageFile)
  } else if (form.imageUrl) {
    fd.append('image_url', form.imageUrl)
  } else if (!form.imagePreview) {
    fd.append('remove_image', 'true')
  }
  if (form.materialFile) fd.append('additional_material', form.materialFile)
  return fd
}

export function createEmptyRecipeForm(methods = [], categories = []) {
  return {
    ...defaultRecipeForm,
    cooking_method: String(methods[0]?.id || ''),
    categories: categories[0] ? [String(categories[0].id)] : [],
  }
}


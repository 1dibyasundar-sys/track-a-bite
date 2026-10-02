import { IFoodDatabaseService, FoodItem, FoodFilterOptions, Region } from '../types';
import { INDIAN_FOOD_DATABASE } from '../../data/foods';

function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export class FoodDatabaseService implements IFoodDatabaseService {
  private foods: FoodItem[] = [...INDIAN_FOOD_DATABASE];

  async getAllFoods(): Promise<FoodItem[]> {
    return Promise.resolve([...this.foods]);
  }

  getAllFoodsSync(): FoodItem[] {
    return [...this.foods];
  }

  async getFoodById(id: string): Promise<FoodItem | null> {
    return Promise.resolve(this.getFoodByIdSync(id));
  }

  getFoodByIdSync(id: string): FoodItem | null {
    if (!id || typeof id !== 'string') return null;
    const cleanId = id.trim().toLowerCase();
    const item = this.foods.find(f => f.id.toLowerCase() === cleanId);
    return item ? { ...item } : null;
  }

  async findFoodByName(name: string): Promise<FoodItem | null> {
    return Promise.resolve(this.findFoodByNameSync(name));
  }

  findFoodByNameSync(name: string): FoodItem | null {
    if (!name || typeof name !== 'string') return null;
    const normalized = normalizeString(name);
    if (!normalized) return null;

    // 1. Exact canonical name match
    const exact = this.foods.find(f => normalizeString(f.name) === normalized);
    if (exact) return { ...exact };

    // 2. Substring match
    const substring = this.foods.find(
      f =>
        normalizeString(f.name).includes(normalized) ||
        normalized.includes(normalizeString(f.name))
    );
    if (substring) return { ...substring };

    // 3. Match against local names (Hindi, Tamil, etc.)
    const localMatch = this.foods.find(f =>
      Object.values(f.localNames).some(ln => ln && normalizeString(ln).includes(normalized))
    );
    if (localMatch) return { ...localMatch };

    return null;
  }

  async findFoodByAlias(alias: string): Promise<FoodItem | null> {
    return Promise.resolve(this.findFoodByAliasSync(alias));
  }

  findFoodByAliasSync(alias: string): FoodItem | null {
    if (!alias || typeof alias !== 'string') return null;
    const normalized = normalizeString(alias);
    if (!normalized) return null;

    // 1. First check aliases array on each food
    for (const food of this.foods) {
      if (food.aliases && Array.isArray(food.aliases)) {
        for (const a of food.aliases) {
          if (normalizeString(a) === normalized) {
            return { ...food };
          }
        }
      }
    }

    // 2. Partial match in aliases array
    for (const food of this.foods) {
      if (food.aliases && Array.isArray(food.aliases)) {
        for (const a of food.aliases) {
          const normA = normalizeString(a);
          if (normA.includes(normalized) || normalized.includes(normA)) {
            return { ...food };
          }
        }
      }
    }

    // 3. Fallback to name search
    return this.findFoodByNameSync(alias);
  }

  async searchFoods(options: string | FoodFilterOptions): Promise<FoodItem[]> {
    if (typeof options === 'string') {
      return this.searchByQueryString(options);
    }

    let filtered = [...this.foods];

    if (options.query && options.query.trim().length > 0) {
      const q = normalizeString(options.query);
      filtered = filtered.filter(f => {
        const matchesName = normalizeString(f.name).includes(q);
        const matchesDesc = normalizeString(f.description).includes(q);
        const matchesAliases = f.aliases?.some(a => normalizeString(a).includes(q));
        const matchesLocal = Object.values(f.localNames).some(
          name => name && normalizeString(name).includes(q)
        );
        const matchesIng = f.commonIngredients.some(i => normalizeString(i).includes(q));
        return matchesName || matchesDesc || matchesAliases || matchesLocal || matchesIng;
      });
    }

    if (options.region && options.region !== 'All') {
      filtered = filtered.filter(f => f.region === options.region || f.region === 'Pan-India');
    }

    if (options.category && options.category !== 'All') {
      filtered = filtered.filter(f => f.category === options.category);
    }

    if (options.affordability && options.affordability !== 'All') {
      filtered = filtered.filter(f => f.affordability === options.affordability);
    }

    if (options.dietaryTag && options.dietaryTag !== 'All') {
      filtered = filtered.filter(f => f.dietaryTags.includes(options.dietaryTag as import('../types').DietaryTag));
    }

    if (options.sortBy) {
      switch (options.sortBy) {
        case 'protein':
          filtered.sort((a, b) => b.nutritionPerServing.protein - a.nutritionPerServing.protein);
          break;
        case 'fiber':
          filtered.sort((a, b) => b.nutritionPerServing.fiber - a.nutritionPerServing.fiber);
          break;
        case 'calories':
          filtered.sort((a, b) => a.nutritionPerServing.calories - b.nutritionPerServing.calories);
          break;
        case 'name':
          filtered.sort((a, b) => a.name.localeCompare(b.name));
          break;
        case 'affordability':
          filtered.sort((a, b) => {
            const order = { 'Budget-Friendly': 1, 'Moderate': 2, 'Specialty / Festive': 3 };
            return (order[a.affordability] || 2) - (order[b.affordability] || 2);
          });
          break;
      }
    }

    return Promise.resolve(filtered);
  }

  private searchByQueryString(query: string): Promise<FoodItem[]> {
    const q = normalizeString(query);
    if (!q) return Promise.resolve([...this.foods]);

    const results = this.foods.filter(f => {
      const inName = normalizeString(f.name).includes(q);
      const inId = normalizeString(f.id).includes(q);
      const inAliases = f.aliases?.some(a => normalizeString(a).includes(q));
      const inCategory = normalizeString(f.category).includes(q);
      return inName || inId || inAliases || inCategory;
    });

    return Promise.resolve(results);
  }

  async getAffordableProteins(): Promise<FoodItem[]> {
    return Promise.resolve(
      this.foods.filter(
        f =>
          f.affordability === 'Budget-Friendly' &&
          (f.dietaryTags.includes('High-Protein') || f.nutrition.protein >= 7)
      )
    );
  }

  async getByRegion(region: Region): Promise<FoodItem[]> {
    return Promise.resolve(
      this.foods.filter(f => f.region === region || f.region === 'Pan-India')
    );
  }
}

export const foodDatabaseService = new FoodDatabaseService();

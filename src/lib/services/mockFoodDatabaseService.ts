import { IFoodDatabaseService, FoodItem, FoodFilterOptions, Region } from '../types';
import { INDIAN_FOOD_DATABASE } from '../../data/foods';

export class MockFoodDatabaseService implements IFoodDatabaseService {
  private foods: FoodItem[] = [...INDIAN_FOOD_DATABASE];

  async getAllFoods(): Promise<FoodItem[]> {
    return Promise.resolve([...this.foods]);
  }

  async getFoodById(id: string): Promise<FoodItem | null> {
    const item = this.foods.find(f => f.id === id);
    return Promise.resolve(item ? { ...item } : null);
  }

  async findFoodByName(name: string): Promise<FoodItem | null> {
    const q = name.toLowerCase().trim();
    const item = this.foods.find(
      f => f.name.toLowerCase().includes(q) || q.includes(f.name.toLowerCase())
    );
    return Promise.resolve(item ? { ...item } : null);
  }

  async findFoodByAlias(alias: string): Promise<FoodItem | null> {
    const q = alias.toLowerCase().trim();
    const item = this.foods.find(
      f => f.aliases?.some(a => a.toLowerCase() === q) || f.name.toLowerCase() === q
    );
    return Promise.resolve(item ? { ...item } : null);
  }

  async searchFoods(options: FoodFilterOptions): Promise<FoodItem[]> {
    let filtered = [...this.foods];

    if (options.query && options.query.trim().length > 0) {
      const q = options.query.toLowerCase().trim();
      filtered = filtered.filter(f => {
        const matchesName = f.name.toLowerCase().includes(q);
        const matchesDesc = f.description.toLowerCase().includes(q);
        const matchesLocal = Object.values(f.localNames).some(name => name?.toLowerCase().includes(q));
        const matchesIng = f.commonIngredients.some(i => i.toLowerCase().includes(q));
        return matchesName || matchesDesc || matchesLocal || matchesIng;
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

  async getAffordableProteins(): Promise<FoodItem[]> {
    return Promise.resolve(
      this.foods.filter(
        f => f.affordability === 'Budget-Friendly' && (f.dietaryTags.includes('High-Protein') || f.nutritionPerServing.protein >= 7)
      )
    );
  }

  async getByRegion(region: Region): Promise<FoodItem[]> {
    return Promise.resolve(
      this.foods.filter(f => f.region === region || f.region === 'Pan-India')
    );
  }
}

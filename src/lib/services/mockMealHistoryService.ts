import { IMealHistoryService, MealAnalysis } from '../types';
import { MOCK_SAVED_MEALS } from '../../data/mockMeals';

const STORAGE_KEY = 'track_a_bite_meal_history';

export class MockMealHistoryService implements IMealHistoryService {
  private inMemoryMeals: MealAnalysis[] = [...MOCK_SAVED_MEALS];

  private getFromStorage(): MealAnalysis[] {
    if (typeof window === 'undefined') {
      return this.inMemoryMeals;
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // Ignore localStorage parse errors and fallback
    }
    return this.inMemoryMeals;
  }

  private saveToStorage(meals: MealAnalysis[]) {
    this.inMemoryMeals = meals;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(meals));
      } catch {
        // Handle quota errors gracefully
      }
    }
  }

  async getRecentMeals(): Promise<MealAnalysis[]> {
    return Promise.resolve(this.getFromStorage());
  }

  async getMealById(id: string): Promise<MealAnalysis | null> {
    const meals = this.getFromStorage();
    const found = meals.find(m => m.id === id);
    return Promise.resolve(found ? { ...found } : null);
  }

  async saveMeal(meal: MealAnalysis): Promise<void> {
    const meals = this.getFromStorage();
    // Add to top of list, prevent duplicate id
    const filtered = meals.filter(m => m.id !== meal.id);
    const updated = [meal, ...filtered];
    this.saveToStorage(updated);
    return Promise.resolve();
  }

  async deleteMeal(id: string): Promise<void> {
    const meals = this.getFromStorage();
    const updated = meals.filter(m => m.id !== id);
    this.saveToStorage(updated);
    return Promise.resolve();
  }

  async getMealsForDateRange(startDate?: string, endDate?: string): Promise<MealAnalysis[]> {
    const all = this.getFromStorage();
    if (!startDate && !endDate) return Promise.resolve(all);
    const filtered = all.filter(m => {
      const d = (m.analyzedAt || '').slice(0, 10);
      if (startDate && d < startDate) return false;
      if (endDate && d > endDate) return false;
      return true;
    });
    return Promise.resolve(filtered);
  }

  async clearHistory(): Promise<void> {
    this.inMemoryMeals = [];
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Ignore quota/removal errors
      }
    }
    return Promise.resolve();
  }
}

'use client';

import React, { useState, useEffect } from 'react';
import { Container } from '../../components/layout/container';
import { SectionHeading } from '../../components/common/section-heading';
import { FoodCard } from '../../components/food/food-card';
import { FoodFilterBar } from '../../components/food/food-filter-bar';
import { EmptyState } from '../../components/common/empty-state';
import { foodDatabaseService } from '../../lib/services';
import { FoodItem, FoodFilterOptions } from '../../lib/types';
import { SearchIcon } from '../../components/ui/icons';

export default function FoodsPage() {
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [filters, setFilters] = useState<FoodFilterOptions>({
    query: '',
    region: 'All',
    category: 'All',
    affordability: 'All',
    sortBy: 'name',
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchFiltered() {
      setIsLoading(true);
      const data = await foodDatabaseService.searchFoods(filters);
      setFoods(data);
      setIsLoading(false);
    }
    fetchFiltered();
  }, [filters]);

  const handleResetFilters = () => {
    setFilters({
      query: '',
      region: 'All',
      category: 'All',
      affordability: 'All',
      sortBy: 'name',
    });
  };

  return (
    <div className="py-8 sm:py-12 space-y-8">
      <Container size="lg">
        <SectionHeading
          eyebrow="Regional Food Directory"
          title="Indian &amp; Regional Food Database"
          description="Explore traditional dishes, millets, dals, and regional staples with transparent nutritional profiles, cultural context, and affordability ratings."
        />

        {/* Filter Controls */}
        <FoodFilterBar
          filters={filters}
          onChange={setFilters}
          resultCount={foods.length}
        />

        {/* Loading / Results Grid */}
        {isLoading ? (
          <div className="py-20 text-center">
            <div className="inline-block w-8 h-8 border-3 border-emerald-700 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-xs text-stone-500 font-medium">Filtering regional foods...</p>
          </div>
        ) : foods.length === 0 ? (
          <EmptyState
            icon={<SearchIcon size={24} />}
            title="No matching foods found"
            description="We couldn't find any dishes matching your current filter combination. Try adjusting the search term or resetting your regional filters."
            actionLabel="Reset Filters"
            onAction={handleResetFilters}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {foods.map(food => (
              <FoodCard key={food.id} food={food} />
            ))}
          </div>
        )}
      </Container>
    </div>
  );
}

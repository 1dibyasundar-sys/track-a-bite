'use client';

import React from 'react';
import Link from 'next/link';
import { Container } from '../../components/layout/container';
import { SectionHeading } from '../../components/common/section-heading';
import { Button } from '../../components/ui/button';
import { AuthGuard } from '../../components/auth/AuthGuard';
import { useAuth } from '../../components/auth/AuthProvider';
import { NutritionAnalyticsDashboard } from '../../components/nutrition/nutrition-analytics-dashboard';
import { CameraIcon, HistoryIcon } from '../../components/ui/icons';

export default function ReportsPage() {
  const { user } = useAuth();

  return (
    <AuthGuard>
      <div className="py-8 sm:py-12 space-y-8">
        <Container size="lg">
          <SectionHeading
            eyebrow="Nutrition Reports"
            title="Dietary Analytics & Export"
            description="Review your daily macronutrient trends, micro-mineral adequacy, hydration balance, and export complete journals in CSV or JSON format."
            action={
              <div className="flex items-center gap-2">
                <Link href="/history">
                  <Button variant="outline" size="sm" leftIcon={<HistoryIcon size={16} />}>
                    Meal History
                  </Button>
                </Link>
                <Link href="/scan">
                  <Button size="sm" leftIcon={<CameraIcon size={16} />}>
                    Scan Food
                  </Button>
                </Link>
              </div>
            }
          />

          <NutritionAnalyticsDashboard userId={user?.uid} />
        </Container>
      </div>
    </AuthGuard>
  );
}

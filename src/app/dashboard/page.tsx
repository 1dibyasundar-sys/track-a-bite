import { Metadata } from 'next';
import { NutritionDashboard } from '../../components/dashboard/NutritionDashboard';
import { AuthGuard } from '../../components/auth/AuthGuard';

export const metadata: Metadata = {
  title: 'Nutrition Dashboard | Track-a-Bite',
  description: 'Your daily personalized nutrition command center, meal tracking, micronutrients, and hydration journey.',
};

export default function DashboardPage() {
  return (
    <AuthGuard>
      <NutritionDashboard />
    </AuthGuard>
  );
}

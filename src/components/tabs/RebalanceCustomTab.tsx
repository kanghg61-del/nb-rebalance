'use client';
import { ScenarioMatrix } from './RebalanceBasicTab';
import { CLR } from '@/lib/theme';
export function RebalanceCustomTab() {
  return <ScenarioMatrix scenarioKey="🎛️ 임의" allowSlider={true} descBorderColor={CLR.yel_fg} />;
}

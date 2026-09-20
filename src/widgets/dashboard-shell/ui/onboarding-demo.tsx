"use client";

import { ReportDashboard } from "@/entities/report/ui";
import { AskDataPanel } from "@/features/query-report";
import {
  onboardingDemoAsk,
  onboardingDemoReport,
} from "../model/onboarding-demo";

export function OnboardingDemo() {
  return (
    <section
      aria-label="Демо-результат анализа"
      className="onboarding-demo-workspace onboarding-demo-analysis"
    >
      <ReportDashboard onboardingDemo report={onboardingDemoReport} />
      <AskDataPanel onboardingDemo send={onboardingDemoAsk} />
    </section>
  );
}

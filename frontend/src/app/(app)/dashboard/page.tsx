'use client';

import DailyOverview from "@/components/dashboard/daily-overview";
import { useApp } from "@/context/app-context";
import { ComponentErrorBoundary } from "@/components/error-boundary";

export default function DashboardPage() {
    const { isKanbanHeaderVisible } = useApp();

    return (
        <>
            {isKanbanHeaderVisible && (
                <ComponentErrorBoundary>
                    <DailyOverview />
                </ComponentErrorBoundary>
            )}
        </>
    );
}

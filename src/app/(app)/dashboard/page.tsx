'use client';

import DailyOverview from "@/components/dashboard/daily-overview";
import { useApp } from "@/context/app-context";

export default function DashboardPage() {
    const { isKanbanHeaderVisible } = useApp();

    return (
        <>
            {isKanbanHeaderVisible && <DailyOverview />}
        </>
    );
}

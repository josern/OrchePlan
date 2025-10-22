"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ThemeToggle } from "@/components/theme-toggle";
import { useApp } from "@/context/app-context";
import { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AppearanceForm() {
  const { isSidebarOpenByDefault, toggleSidebarDefault, cardDensity, setCardDensity } = useApp();
  
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>
          Customize the look and feel of the application.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        { mounted ? (
            <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                    <Label htmlFor="sidebar-default-open" className="text-base">
                        Open Sidebar by Default
                    </Label>
                    <p className="text-sm text-muted-foreground">
                        Control whether the project sidebar is open when you load the app.
                    </p>
                </div>
                <Switch
                    id="sidebar-default-open"
                    checked={isSidebarOpenByDefault}
                    onCheckedChange={toggleSidebarDefault}
                />
            </div>
        ) : (
            <div className="flex items-center justify-between rounded-lg border p-4 h-[92px]">
                <div className="space-y-2.5">
                    <div className="h-5 w-40 bg-muted rounded-md" />
                    <div className="h-4 w-64 bg-muted rounded-md" />
                </div>
                <div className="h-6 w-11 bg-muted rounded-full" />
            </div>
        )}
        <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
                <Label className="text-base">
                    Theme
                </Label>
                <p className="text-sm text-muted-foreground">
                    Change the application theme.
                </p>
            </div>
            <ThemeToggle />
        </div>
        <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
                <Label className="text-base">Card density</Label>
                <p className="text-sm text-muted-foreground">Choose comfortable or compact task card density.</p>
            </div>
            <Tabs value={cardDensity} onValueChange={(v) => setCardDensity(v as 'comfortable' | 'compact')}>
                <TabsList>
                    <TabsTrigger value="comfortable">Comfortable</TabsTrigger>
                    <TabsTrigger value="compact">Compact</TabsTrigger>
                </TabsList>
            </Tabs>
        </div>
      </CardContent>
    </Card>
  );
}

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/context/app-context";
import ThemeProviderClient from "@/components/theme-provider-client";
import { Toaster } from "@/components/ui/toaster";
import { CriticalErrorBoundary } from "@/components/error-boundary";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "OrchePlan",
  description: "Orchestrator Planner",
  icons: {
    icon: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <CriticalErrorBoundary>
          <ThemeProviderClient
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <AppProvider>
              {children}
            </AppProvider>
            <Toaster />
          </ThemeProviderClient>
        </CriticalErrorBoundary>
      </body>
    </html>
  );
}

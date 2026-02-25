import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "TmPlan",
  description: "帮你创建、完善和监督计划的项目",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh">
      <body className="antialiased">
        <AppShell>{children}</AppShell>
        <Toaster />
      </body>
    </html>
  );
}

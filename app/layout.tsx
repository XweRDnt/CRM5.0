import type { Metadata } from "next";
import Script from "next/script";
import { cookies } from "next/headers";
import { AppToaster } from "@/components/ui/app-toaster";
import { AppThemeShell } from "@/components/theme/AppThemeShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Video CRM MVP",
  description: "Minimal CRM UI for video projects",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const savedTheme = cookieStore.get("app-theme")?.value;
  const initialTheme = savedTheme === "dark" ? "dark" : "light";

  return (
    <html lang="en" data-app-theme={initialTheme} suppressHydrationWarning>
      <head>
        <Script id="app-theme-init" strategy="beforeInteractive">
          {`
            (function () {
              try {
                var saved = localStorage.getItem("app-theme");
                var theme = saved === "dark" ? "dark" : "light";
                document.documentElement.dataset.appTheme = theme;
                document.cookie = "app-theme=" + theme + "; path=/; max-age=31536000; samesite=lax";
              } catch (e) {
                document.documentElement.dataset.appTheme = "light";
              }
            })();
          `}
        </Script>
      </head>
      <body className="antialiased">
        <AppThemeShell>{children}</AppThemeShell>
        <AppToaster />
      </body>
    </html>
  );
}

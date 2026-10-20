import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Big Think Rewards", template: "%s · Big Think Rewards" },
  description: "Earn points every time your business is funded with Big Think Capital, and redeem them for rewards.",
};

export const viewport: Viewport = {
  themeColor: "#060b17",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jakarta.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        {children}
        <Toaster
          theme="dark"
          position="top-center"
          toastOptions={{
            classNames: {
              toast: "!bg-surface-2 !border !border-line-strong !text-ink !rounded-2xl !shadow-pop",
              description: "!text-ink-2",
            },
          }}
        />
      </body>
    </html>
  );
}

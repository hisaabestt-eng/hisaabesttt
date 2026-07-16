import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import NavBar from "@/components/NavBar";
import { getServerSession } from "@/lib/session";

// Runs before paint so the page never flashes the wrong theme: a saved
// choice in localStorage wins, otherwise it follows the OS preference.
const THEME_INIT_SCRIPT = `
  (function () {
    var stored = localStorage.getItem("theme");
    var dark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", dark);
  })();
`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Besttt Hisaab",
  description: "Estimate to payment tracking",
};

export default async function RootLayout({ children }) {
  const session = await getServerSession();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-gray-100 dark:bg-gray-900">
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <NavBar session={session} />
        <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6">{children}</main>
      </body>
    </html>
  );
}

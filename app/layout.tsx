import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HR X - HR Live",
  description: "HR expert talking club workspace"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body suppressHydrationWarning>
        {/* HRX global nav */}
        <header className="hrx-topbar">
          <nav className="hrx-topbar-left">
            <a href="#" className="hrx-nav-back">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              HR Room
            </a>
            <span className="hrx-divider" />
            <span className="hrx-nav-brand">
              <span className="hrx-brand-icon">X</span>
              HR X
            </span>
            <span className="hrx-divider" />
            <a href="#" className="hrx-nav-agentic">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              Agentic Platform
            </a>
          </nav>
          <div className="hrx-topbar-right">
            <span className="hrx-claude-badge">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M2.5 6.5l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Claude connected
            </span>
          </div>
        </header>

        {/* HRX tab bar */}
        <div className="hrx-tabbar">
          <div className="hrx-tabbar-inner">
            <a href="#" className="hrx-tab hrx-tab-feedback">
              <span className="hrx-tab-dot hrx-dot-orange" />
              Feedback Vocabulary
            </a>
            <a href="#" className="hrx-tab hrx-tab-global">
              <span className="hrx-tab-dot hrx-dot-blue" />
              Global HR Pool
            </a>
            <span className="hrx-tab hrx-tab-live hrx-tab-active">
              <span className="hrx-tab-dot hrx-dot-teal" />
              HR Live
            </span>
          </div>
        </div>

        {/* main content */}
        {children}
      </body>
    </html>
  );
}

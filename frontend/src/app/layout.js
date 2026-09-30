import './globals.css';
import { AuthProvider } from '@/lib/authContext';

export const metadata = {
  title: 'JobPilot — Autonomous AI Job Search & Application Platform',
  description: 'AI-powered job discovery, automated ATS resume tailoring per JD, and human-in-the-loop auto-applying.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#080c14] text-slate-100 antialiased selection:bg-indigo-500 selection:text-white">
        <AuthProvider>
          <div className="relative min-h-screen flex flex-col">
            {/* Ambient Background Gradient Glows */}
            <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
              <div className="absolute -top-40 left-1/4 h-[500px] w-[500px] rounded-full bg-indigo-600/10 blur-[130px]" />
              <div className="absolute top-1/3 -right-20 h-[450px] w-[450px] rounded-full bg-cyan-600/10 blur-[130px]" />
              <div className="absolute -bottom-20 left-1/3 h-[500px] w-[500px] rounded-full bg-violet-600/10 blur-[140px]" />
            </div>
            
            <div className="relative z-10 flex-1 flex flex-col">
              {children}
            </div>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}

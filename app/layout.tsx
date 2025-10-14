import "./globals.css";
import "./theme-overrides.css";
import { Inter, Nunito } from "next/font/google";
import { Toaster } from "sonner";
import AuthLayout from "../components/AuthLayout";
import { VideoCleanup } from "../components/VideoCleanup";
import { Toaster as ReactHotToastToaster } from 'react-hot-toast';
import { AuthProvider } from "../contexts/AuthContext";
import { SupabaseSync } from "../components/SupabaseSync";

const inter = Inter({ subsets: ["latin"] });
const nunito = Nunito({ 
  subsets: ["latin"],
  weight: ["600"],
  variable: '--font-nunito',
});

export const metadata = {
  title: 'Bluum - Video Generator',
  description: 'Create engaging videos with templates, media, and hooks',
  icons: {
    icon: '/BluumFavicon.png',
    shortcut: '/BluumFavicon.png',
    apple: '/BluumFavicon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
        <html lang="en" suppressHydrationWarning className={nunito.variable}>
          <head>
            <script dangerouslySetInnerHTML={{ __html: `
              // Set light mode theme when DOM is ready
              if (document.body) {
                document.body.style.backgroundColor = '#f3f4f0';
              } else {
                document.addEventListener('DOMContentLoaded', function() {
                  if (document.body) {
                    document.body.style.backgroundColor = '#f3f4f0';
                  }
                });
              }
            `}} />
          </head>
          <body className={`${inter.className}`} style={{ backgroundColor: '#f3f4f0' }} suppressHydrationWarning>
            <div className="min-h-screen flex" style={{ backgroundColor: '#f3f4f0' }}>
              <AuthLayout>
                {children}
              </AuthLayout>
            </div>
            <Toaster position="top-center" />
            <VideoCleanup />
            <ReactHotToastToaster position="bottom-center" />
            <SupabaseSync />
          </body>
        </html>
    </AuthProvider>
  );
} 
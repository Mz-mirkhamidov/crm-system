import { Sidebar } from "@/components/sidebar";
import { ToastProvider } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="flex-1 ml-60 min-h-screen">
          <div className="p-6 max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
      <Toaster />
    </ToastProvider>
  );
}

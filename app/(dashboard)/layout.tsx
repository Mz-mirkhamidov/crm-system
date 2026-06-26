import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { ToastProvider } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { getServerOperator } from "@/lib/auth-server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await getServerOperator();
  if (!me) redirect("/login");
  if (me.mustChangePassword) redirect("/set-password");

  return (
    <ToastProvider>
      <div className="min-h-screen bg-background">
        <Sidebar />
        <main className="md:ml-60 min-h-screen pt-14 md:pt-0">
          <div className="p-4 sm:p-6 max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
      <Toaster />
    </ToastProvider>
  );
}

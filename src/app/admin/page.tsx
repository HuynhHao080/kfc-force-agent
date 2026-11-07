import type { Metadata } from "next";
import { AdminConsole } from "@/components/admin/admin-console";
export const metadata: Metadata = {
  title: "Vận hành | KFC Force Agent",
  robots: { index: false, follow: false },
};
export default function AdminPage() {
  return <AdminConsole />;
}

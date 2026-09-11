import { redirect } from "next/navigation";

export default function AdminDocumentationRedirect() {
  redirect("/admin/files");
}

import { redirect } from "next/navigation";

export default function ClientDocumentationRedirect() {
  redirect("/client/files");
}

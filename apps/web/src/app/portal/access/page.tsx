import { redirect } from "next/navigation";

export default function PortalAccessRedirect() {
  redirect("/client/access");
}

import { Suspense } from "react";
import LoginForm from "./login-form";
import { PageSkeleton } from "@/components/hub/states";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center p-8">
          <PageSkeleton />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

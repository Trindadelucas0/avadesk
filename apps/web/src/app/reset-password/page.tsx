import { Suspense } from "react";
import { PageSkeleton } from "@/components/hub/states";
import ResetPasswordForm from "./reset-form";

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center p-8">
          <PageSkeleton />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}

import { redirect } from "next/navigation";

import { signUpAction } from "@/app/actions";
import { AuthCard } from "@/components/auth-card";
import { getCurrentUser } from "@/lib/auth";

export default async function SignUpPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/workspace");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#26315e_0%,#0b1023_45%,#070a18_100%)] p-4">
      <AuthCard
        title="Create Manager Account"
        description="Manager-only signup for now. Worker invites come next."
        submitLabel="Create Account"
        footerText="Already have an account?"
        footerLinkText="Sign in"
        footerHref="/sign-in"
        action={signUpAction}
      />
    </main>
  );
}

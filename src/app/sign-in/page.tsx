import { redirect } from "next/navigation";

import { signInAction } from "@/app/actions";
import { AuthCard } from "@/components/auth-card";
import { getCurrentUser } from "@/lib/auth";

export default async function SignInPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/workspace");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#26315e_0%,#0b1023_45%,#070a18_100%)] p-4">
      <AuthCard
        title="Manager Sign In"
        description="Sign in to manage your team spaces, projects, and tasks."
        submitLabel="Sign In"
        footerText="Need an account?"
        footerLinkText="Create one"
        footerHref="/sign-up"
        action={signInAction}
      />
    </main>
  );
}

import Link from "next/link";
import type { Route } from "next";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AuthCardProps = {
  title: string;
  description: string;
  submitLabel: string;
  footerText: string;
  footerLinkText: string;
  footerHref: Route;
  action: (formData: FormData) => Promise<void>;
};

export function AuthCard({
  title,
  description,
  submitLabel,
  footerText,
  footerLinkText,
  footerHref,
  action,
}: AuthCardProps) {
  return (
    <Card className="w-full max-w-md border-border/80 bg-card/95 backdrop-blur">
      <CardHeader className="space-y-2">
        <CardTitle className="text-2xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required placeholder="manager@company.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" required minLength={8} placeholder="••••••••" />
          </div>
          <Button className="w-full" type="submit">
            {submitLabel}
          </Button>
        </form>
        <p className="mt-4 text-sm text-muted-foreground">
          {footerText} <Link href={footerHref} className="text-primary hover:underline">{footerLinkText}</Link>
        </p>
      </CardContent>
    </Card>
  );
}

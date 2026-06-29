"use client";

import { signOutAction } from "@/actions/sign-out";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  return (
    <form action={signOutAction}>
      <Button type="submit" variant="ghost" size="sm">
        <LogOut className="h-4 w-4 mr-1" />
        Log out
      </Button>
    </form>
  );
}

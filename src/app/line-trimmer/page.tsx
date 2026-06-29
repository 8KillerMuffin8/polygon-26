import { auth } from "@/auth";
import { isGuest } from "@/lib/auth-utils";
import { redirect } from "next/navigation";
import { LineTrimmerContent } from "@/components/line-trimmer/line-trimmer-page-content";

export default async function LineTrimmerPage() {
  const session = await auth();
  if (isGuest(session)) {
    redirect("/");
  }

  return <LineTrimmerContent />;
}

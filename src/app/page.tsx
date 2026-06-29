import { auth } from "@/auth";
import { isGuest } from "@/lib/auth-utils";
import { HomePage } from "@/components/home-page";

export default async function Page() {
  const session = await auth();
  return <HomePage isGuest={isGuest(session)} />;
}

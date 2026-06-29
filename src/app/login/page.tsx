import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Polygon Search</CardTitle>
          <p className="text-sm text-muted-foreground">Sign in to continue</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/" });
            }}
          >
            <Button type="submit" className="w-full" size="lg">
              Sign in with Google
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>

          <form
            action={async () => {
              "use server";
              await signIn("guest", { redirectTo: "/" });
            }}
          >
            <Button
              type="submit"
              variant="outline"
              className="w-full"
              size="lg"
            >
              Continue as Guest
            </Button>
          </form>
          <p className="text-xs text-center text-muted-foreground">
            Guest mode allows search only — no export or line trimming
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

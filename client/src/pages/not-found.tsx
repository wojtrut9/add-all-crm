import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="flex items-center justify-center p-12">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <h1 className="text-2xl font-bold">Strona nie znaleziona</h1>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Nie masz dostepu do tej strony lub nie istnieje.
          </p>
          <Link href="/">
            <Button className="mt-4" data-testid="button-go-home">Wroc do panelu</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

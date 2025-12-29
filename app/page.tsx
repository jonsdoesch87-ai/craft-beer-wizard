import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sprout, Wheat, Flower2, Beaker } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="flex min-h-screen flex-col items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="mb-6 text-5xl font-bold tracking-tight text-foreground sm:text-6xl md:text-7xl">
            Brew Your
            <span className="block text-primary"> Masterpiece</span>
          </h1>
          
          {/* Hero Icons */}
          <div className="mb-8 flex items-center justify-center gap-6 sm:gap-8">
            <Sprout className="h-8 w-8 text-[#4CBB17] sm:h-10 sm:w-10" aria-label="Hops" />
            <Wheat className="h-8 w-8 text-[#4CBB17] sm:h-10 sm:w-10" aria-label="Wheat" />
            <Flower2 className="h-8 w-8 text-[#4CBB17] sm:h-10 sm:w-10" aria-label="Barley" />
          </div>

          <p className="mb-12 text-lg text-muted-foreground sm:text-xl md:text-2xl">
            Create your perfect craft beer recipe.
            <span className="block mt-2 text-primary">
              From beginner to expert – we guide you through every step.
            </span>
          </p>
          
          <Link href="/wizard">
            <Button
              size="lg"
              className="h-14 px-8 text-lg font-semibold transition-all hover:scale-105 bg-[#FFBF00] text-black hover:bg-[#FFBF00]/90"
            >
              <Beaker className="mr-2 h-5 w-5" />
              Start Brewing
            </Button>
          </Link>
        </div>

        {/* Features Section */}
        <div className="mt-24 grid w-full max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="p-6">
            <h3 className="mb-2 text-xl font-semibold text-primary">
              Personalisiert
            </h3>
            <p className="text-muted-foreground">
              Passe dein Rezept an deine Erfahrung und Ausrüstung an
            </p>
          </Card>
          <Card className="p-6">
            <h3 className="mb-2 text-xl font-semibold text-success">
              Präzise
            </h3>
            <p className="text-muted-foreground">
              Erhalte optimale Rezeptvorschläge basierend auf deinen Präferenzen
            </p>
          </Card>
          <Card className="p-6 sm:col-span-2 lg:col-span-1">
            <h3 className="mb-2 text-xl font-semibold text-primary">
              Vielfältig
            </h3>
            <p className="text-muted-foreground">
              Wähle aus verschiedenen Bierstilen und Geschmacksprofilen
            </p>
          </Card>
        </div>
      </section>
    </div>
  );
}

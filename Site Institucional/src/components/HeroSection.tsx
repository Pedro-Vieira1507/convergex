import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, BarChart3, Users, TrendingUp, Activity } from "lucide-react";

const HeroSection = () => {
  const scrollTo = (href: string) => {
    document.querySelector(href)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-28">
      {/* Subtle glow */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-primary/5 blur-[120px]" />

      <div className="relative mx-auto max-w-6xl px-4 text-center sm:px-6">
        <Badge variant="secondary" className="mb-6 animate-fade-in text-sm font-normal">
          🚀 A nova era da automação inteligente
        </Badge>

        <h1 className="mx-auto max-w-3xl animate-fade-in text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl"
            style={{ animationDelay: "0.1s", animationFillMode: "both" }}>
          Centralize, Automatize e Escale com o{" "}
          <span className="text-primary">ConvergeX</span>.
        </h1>

        <p className="mx-auto mt-6 max-w-2xl animate-fade-in text-base text-muted-foreground sm:text-lg"
           style={{ animationDelay: "0.2s", animationFillMode: "both" }}>
          A única plataforma que você precisa para unificar seus dados, automatizar tarefas repetitivas com Inteligência Artificial e focar no que realmente importa: o crescimento do seu negócio.
        </p>

        <div className="mt-8 flex animate-fade-in flex-col items-center gap-3 sm:flex-row sm:justify-center"
             style={{ animationDelay: "0.3s", animationFillMode: "both" }}>
          <Button size="lg" onClick={() => scrollTo("#planos")}>
            Ver Planos <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
          <Button variant="outline" size="lg">Agendar Demonstração</Button>
        </div>

        {/* Dashboard mockup */}
        <div className="mx-auto mt-16 max-w-4xl animate-fade-in rounded-xl border border-border/60 bg-card/60 p-4 shadow-lg backdrop-blur-sm"
             style={{ animationDelay: "0.45s", animationFillMode: "both" }}>
          <div className="rounded-lg bg-background/80 p-6">
            {/* Top bar */}
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Activity className="h-4 w-4 text-primary" /> Dashboard
              </div>
              <div className="flex gap-2">
                <span className="h-3 w-3 rounded-full bg-primary/60" />
                <span className="h-3 w-3 rounded-full bg-muted-foreground/30" />
                <span className="h-3 w-3 rounded-full bg-muted-foreground/30" />
              </div>
            </div>
            {/* Stat cards */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { icon: Users, label: "Usuários Ativos", value: "12.4k", change: "+18%" },
                { icon: TrendingUp, label: "Receita Mensal", value: "R$ 84k", change: "+24%" },
                { icon: BarChart3, label: "Automações", value: "1.2k", change: "+32%" },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border border-border/40 bg-card p-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <s.icon className="h-3.5 w-3.5" /> {s.label}
                  </div>
                  <p className="mt-2 text-xl font-semibold text-foreground">{s.value}</p>
                  <span className="text-xs text-primary">{s.change}</span>
                </div>
              ))}
            </div>
            {/* Chart placeholder */}
            <div className="mt-4 flex h-32 items-end gap-1.5 rounded-lg border border-border/40 bg-card p-4">
              {[40, 65, 45, 80, 55, 90, 70, 85, 60, 95, 75, 88].map((h, i) => (
                <div key={i} className="flex-1 rounded-t bg-primary/70 transition-all hover:bg-primary"
                     style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;

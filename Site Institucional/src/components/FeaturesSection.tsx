import { Card, CardContent } from "@/components/ui/card";
import { Link, Sparkles, BarChart3 } from "lucide-react";

const features = [
  {
    icon: Link,
    title: "Integração Total",
    description:
      "Conecte todas as suas fontes de dados em um só lugar. O ConvergeX conversa nativamente com os principais CRMs, ERPs e ferramentas de marketing do mercado.",
  },
  {
    icon: Sparkles,
    title: "Automação com IA",
    description:
      "Diga adeus ao trabalho manual. Nossa inteligência artificial aprende com os seus processos e cria fluxos de trabalho automáticos que economizam horas da sua equipe.",
  },
  {
    icon: BarChart3,
    title: "Dashboards em Tempo Real",
    description:
      "Tome decisões baseadas em dados atualizados no segundo. Visualize métricas de performance através de painéis customizáveis e intuitivos.",
  },
];

const FeaturesSection = () => (
  <section id="recursos" className="py-20 sm:py-28">
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <div className="mb-14 text-center">
        <h2 className="text-3xl font-bold sm:text-4xl">Por que escolher o ConvergeX?</h2>
        <p className="mt-4 text-muted-foreground">Tudo o que você precisa em uma única plataforma.</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f, i) => (
          <Card
            key={f.title}
            className="group animate-fade-in border-border/50 bg-card transition-all hover:border-primary/30 hover:shadow-lg hover:-translate-y-1"
            style={{ animationDelay: `${i * 0.1}s`, animationFillMode: "both" }}
          >
            <CardContent className="p-6">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">{f.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{f.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  </section>
);

export default FeaturesSection;

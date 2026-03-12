import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Check } from "lucide-react";

const plans = [
  {
    id: "convergex-starter",
    name: "Starter",
    priceDisplay: "R$ 97",
    price: 97.00, // Valor exato que será enviado para a Stripe
    period: "/mês",
    description: "Ideal para autônomos e freelancers.",
    features: ["3 integrações", "Automação básica", "Suporte por e-mail", "1 usuário"],
    cta: "Assinar Starter",
    highlight: false,
    isContact: false,
  },
  {
    id: "convergex-pro",
    name: "Pro",
    priceDisplay: "R$ 297",
    price: 297.00,
    period: "/mês",
    description: "Ideal para pequenas e médias empresas.",
    features: [
      "Integrações ilimitadas",
      "IA avançada",
      "Automação de fluxos",
      "Suporte prioritário",
      "Até 10 usuários",
    ],
    cta: "Assinar Pro",
    highlight: true,
    isContact: false,
  },
  {
    id: "convergex-enterprise",
    name: "Enterprise",
    priceDisplay: "Sob consulta",
    price: 0,
    period: "",
    description: "Para grandes operações que precisam de escala.",
    features: [
      "Servidor dedicado",
      "IA treinada com seus dados",
      "Gerente de contas",
      "SLA personalizado",
      "Usuários ilimitados",
    ],
    cta: "Falar com Vendas",
    highlight: false,
    isContact: true, // Redireciona para contato em vez do checkout
  },
];

const PricingSection = () => {
  const navigate = useNavigate();

  const handleAction = (plan: typeof plans[0]) => {
    if (plan.isContact) {
      // Substitua pelo link do seu formulário ou WhatsApp comercial
      window.open("https://wa.me/5511999999999?text=Olá, tenho interesse no plano Enterprise da Convergex.", "_blank");
    } else {
      // Envia os dados do plano escolhido para a página de Login
      navigate('/login', { state: { plan } });
    }
  };

  return (
    <section id="planos" className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-14 text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">Planos que crescem com você.</h2>
          <p className="mt-4 text-muted-foreground">Sem taxas ocultas. Escolha o plano ideal para o seu momento.</p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan, i) => (
            <Card
              key={plan.name}
              className={`relative animate-fade-in transition-all hover:-translate-y-1 flex flex-col ${
                plan.highlight
                  ? "border-primary/50 shadow-[0_0_30px_-10px_hsl(var(--primary)/0.25)]"
                  : "border-border/50"
              }`}
              style={{ animationDelay: `${i * 0.1}s`, animationFillMode: "both" }}
            >
              {plan.highlight && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                  Mais Popular
                </Badge>
              )}
              <CardHeader className="pb-4">
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-foreground">{plan.priceDisplay}</span>
                  {plan.period && <span className="text-muted-foreground">{plan.period}</span>}
                </div>
              </CardHeader>
              <CardContent className="space-y-6 flex-1 flex flex-col justify-between">
                <ul className="space-y-3 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="h-4 w-4 shrink-0 text-primary" /> {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={plan.highlight ? "default" : "outline"}
                  onClick={() => handleAction(plan)}
                >
                  {plan.cta}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
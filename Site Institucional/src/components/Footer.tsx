import { Zap, Github, Twitter, Linkedin } from "lucide-react";

const Footer = () => (
  <footer className="border-t border-border/50 py-12">
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {/* Brand */}
        <div>
          <a href="#" className="flex items-center gap-2 font-heading text-lg font-bold text-foreground">
            <Zap className="h-5 w-5 text-primary" /> ConvergeX
          </a>
          <p className="mt-3 text-sm text-muted-foreground">
            Centralize, automatize e escale o seu negócio com inteligência artificial.
          </p>
        </div>

        {/* Links */}
        <div>
          <h4 className="mb-3 text-sm font-semibold text-foreground">Produto</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><a href="#recursos" className="transition-colors hover:text-foreground">Recursos</a></li>
            <li><a href="#planos" className="transition-colors hover:text-foreground">Planos</a></li>
            <li><a href="#" className="transition-colors hover:text-foreground">Documentação</a></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold text-foreground">Empresa</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><a href="#" className="transition-colors hover:text-foreground">Sobre</a></li>
            <li><a href="#" className="transition-colors hover:text-foreground">Blog</a></li>
            <li><a href="#" className="transition-colors hover:text-foreground">Contato</a></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold text-foreground">Legal</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><a href="#" className="transition-colors hover:text-foreground">Termos de Uso</a></li>
            <li><a href="#" className="transition-colors hover:text-foreground">Privacidade</a></li>
          </ul>
        </div>
      </div>

      <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-border/50 pt-8 sm:flex-row">
        <p className="text-sm text-muted-foreground">© 2026 ConvergeX. Todos os direitos reservados.</p>
        <div className="flex gap-4">
          <a href="#" className="text-muted-foreground transition-colors hover:text-foreground"><Twitter className="h-4 w-4" /></a>
          <a href="#" className="text-muted-foreground transition-colors hover:text-foreground"><Github className="h-4 w-4" /></a>
          <a href="#" className="text-muted-foreground transition-colors hover:text-foreground"><Linkedin className="h-4 w-4" /></a>
        </div>
      </div>
    </div>
  </footer>
);

export default Footer;

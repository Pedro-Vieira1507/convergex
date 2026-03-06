import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import FeaturesSection from "@/components/FeaturesSection";
import PricingSection from "@/components/PricingSection";
import Footer from "@/components/Footer";

const Index = () => (
  <div className="min-h-screen bg-background text-foreground">
    <Header />
    <main>
      <HeroSection />
      <FeaturesSection />
      <div id="como-funciona" />
      <PricingSection />
    </main>
    <Footer />
  </div>
);

export default Index;

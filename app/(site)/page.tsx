import "@/components/landing/landing.css";
import { getSettings } from "@/lib/settings";
import { Hero } from "@/components/landing/Hero";
import { Problem, Guide, Plan, HowItWorks, Audiences, Marketplace, Success, FinalCta } from "@/components/landing/Sections";
import { Course } from "@/components/landing/Course";
import { PricingPreview } from "@/components/landing/PricingPreview";
import { Faq } from "@/components/landing/Faq";

/** Public landing page (StoryBrand order: hero, problem, guide, plan, the product, audiences, price, success, FAQ, call to action). */
export const revalidate = 300;

export default async function Home() {
  const settings = await getSettings();
  return (
    <>
      <Hero />
      <Problem />
      <Guide />
      <Plan />
      <Course />
      <HowItWorks />
      <Audiences />
      <PricingPreview cohortOpen={!!settings.cohort_open} />
      <Marketplace />
      <Success />
      <Faq />
      <FinalCta />
    </>
  );
}

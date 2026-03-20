import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import { LandingAutoRedirectGate } from "@/components/landing/LandingAutoRedirectGate";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "VideoFeedback — Согласование видео без хаоса",
  description:
    "Сервис согласования видео для агентств и фрилансеров: правки по таймкоду, все версии по одной ссылке, клиент без регистрации.",
  openGraph: {
    title: "VideoFeedback — Согласование видео без хаоса",
    description:
      "Клиент открывает ссылку, оставляет правки по таймкоду — команда сразу видит, что и когда менять.",
    type: "website",
  },
};

const features = [
  "Комментарии по таймкоду",
  "Все версии по одной ссылке",
  "Клиент заходит без регистрации",
];

const steps = [
  "Загрузите видео и отправьте ссылку клиенту",
  "Клиент оставляет правки по таймкоду",
  "Команда видит все правки и делает новую версию",
];

const faqItems = [
  {
    question: "Нужна ли клиенту регистрация?",
    answer: "Нет. Клиент получает ссылку и сразу оставляет правки.",
  },
  {
    question: "Где хранятся видео?",
    answer: "На российских серверах через Кинескоп.",
  },
  {
    question: "Подходит ли для фрилансеров?",
    answer: "Да. Есть тариф для одного человека.",
  },
];

export default function MarketingPage(): JSX.Element {
  return (
    <LandingAutoRedirectGate>
      <main className={`${inter.className} relative min-h-screen overflow-hidden bg-[#070b14] text-slate-100`}>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_12%,rgba(59,130,246,0.22),transparent_32%),radial-gradient(circle_at_86%_0%,rgba(139,92,246,0.2),transparent_34%),radial-gradient(circle_at_40%_100%,rgba(37,99,235,0.12),transparent_42%)]"
        />

        <header className="sticky top-0 z-20 border-b border-white/10 bg-[#070b14]/85 backdrop-blur">
          <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <Link href="/" className="text-base font-semibold tracking-tight text-white sm:text-lg">
              VideoFeedback
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-gradient-to-r from-blue-500 to-violet-500 px-5 py-2 text-sm font-semibold text-white transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              Попробовать
            </Link>
          </div>
        </header>

        <section className="relative mx-auto w-full max-w-6xl px-4 pb-16 pt-20 sm:px-6 sm:pt-24 lg:px-8 lg:pb-24">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-semibold leading-tight text-white sm:text-5xl">
              &&&Согласуйте видео с клиентом без хаоса в Telegram
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
              Клиент открывает ссылку, оставляет правки по таймкоду — вы сразу видите что и когда менять. Без
              регистрации, без переписок.
            </p>
            <div className="mt-8">
              <Link
                href="/signup"
                className="inline-flex rounded-full bg-gradient-to-r from-blue-500 to-violet-500 px-7 py-3 text-sm font-semibold text-white transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                Попробовать
              </Link>
            </div>
          </div>
        </section>

        <section id="features" className="relative mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="grid gap-4 md:grid-cols-3">
            {features.map((feature) => (
              <article
                key={feature}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.03)_inset]"
              >
                <h2 className="text-lg font-medium text-white">{feature}</h2>
              </article>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="relative mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">Как это работает</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {steps.map((step, index) => (
              <article key={step} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <p className="text-sm font-semibold text-blue-300">Шаг {index + 1}</p>
                <p className="mt-3 text-base leading-relaxed text-slate-200">{step}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="relative mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-blue-400/30 bg-gradient-to-br from-blue-500/15 to-violet-500/15 p-8 sm:p-10">
            <h2 className="text-2xl font-semibold text-white sm:text-3xl">Готовы попробовать?</h2>
            <div className="mt-6 flex flex-col items-start gap-4">
              <Link
                href="/signup"
                className="rounded-full bg-gradient-to-r from-blue-500 to-violet-500 px-7 py-3 text-sm font-semibold text-white transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                Попробовать
              </Link>
              <p className="text-sm text-slate-300">
                Или напишите нам в Telegram:{" "}
                <a
                  href="https://t.me/creative3228"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-blue-300 underline decoration-blue-400/70 underline-offset-4 transition hover:text-blue-200"
                >
                  @creative3228
                </a>
              </p>
            </div>
          </div>
        </section>

        <section id="faq" className="relative mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">FAQ</h2>
          <div className="mt-8 space-y-4">
            {faqItems.map((item) => (
              <article key={item.question} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <h3 className="text-lg font-medium text-white">{item.question}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">{item.answer}</p>
              </article>
            ))}
          </div>
        </section>

        <footer className="relative border-t border-white/10 px-4 py-8 text-center text-sm text-slate-400 sm:px-6 lg:px-8">
          © 2026 VideoFeedback
        </footer>
      </main>
    </LandingAutoRedirectGate>
  );
}

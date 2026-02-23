import type { Metadata } from "next";
import Link from "next/link";
import { Bot, Clock3, MessageSquareText, ShieldCheck, Sparkles, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CTASection, FAQ, Features, Footer, Hero, HowItWorks, Pricing } from "@/components/landing";
import { LoginEntryButton } from "@/components/landing/LoginEntryButton";

export const metadata: Metadata = {
  title: "VideoFeedback - Ускорьте согласование видео",
  description:
    "Собирайте комментарии по таймкодам, автоматизируйте задачи и закрывайте проекты быстрее с VideoFeedback.",
  keywords: ["видеофидбек", "согласование видео", "клиентские правки", "video crm"],
  openGraph: {
    title: "VideoFeedback - Ускорьте согласование видео",
    description:
      "Платформа для студий и агентств: комментарии по таймкоду, AI-резюме правок и прозрачный процесс согласования.",
    type: "website",
  },
};

const features = [
  {
    icon: <Video className="h-6 w-6" aria-hidden="true" />,
    title: "Комментарии по таймкоду",
    description: "Клиенты оставляют фидбек прямо на нужной секунде ролика без лишних переписок.",
  },
  {
    icon: <Bot className="h-6 w-6" aria-hidden="true" />,
    title: "AI-разбор правок",
    description: "Система автоматически выделяет задачи и помогает команде быстрее перейти к исполнению.",
  },
  {
    icon: <Clock3 className="h-6 w-6" aria-hidden="true" />,
    title: "Контроль сроков",
    description: "Следите за статусами этапов и не допускайте просрочек в производственном цикле.",
  },
  {
    icon: <ShieldCheck className="h-6 w-6" aria-hidden="true" />,
    title: "Безопасный доступ",
    description: "Разделяйте доступы для команды и клиентов, сохраняя контроль над проектом.",
  },
  {
    icon: <MessageSquareText className="h-6 w-6" aria-hidden="true" />,
    title: "Единая лента обсуждений",
    description: "Все комментарии, решения и ответы собраны в одном месте и не теряются в чатах.",
  },
  {
    icon: <Sparkles className="h-6 w-6" aria-hidden="true" />,
    title: "Прозрачность для клиента",
    description: "Покажите прогресс, историю версий и текущие задачи в понятном клиентском портале.",
  },
];

const steps = [
  {
    title: "Загрузите версию видео",
    description: "Добавьте новый ролик в проект и отправьте ссылку клиенту за пару кликов.",
  },
  {
    title: "Соберите фидбек",
    description: "Клиент оставляет комментарии по таймкоду, а команда видит всё в структурированном виде.",
  },
  {
    title: "Закройте задачи",
    description: "Преобразуйте правки в задачи и проведите проект до финального согласования быстрее.",
  },
];

const plans = [
  {
    name: "Старт",
    description: "Для небольших продакшен-команд",
    price: 29,
    cta: { text: "Начать", href: "/signup" },
    features: ["До 5 активных проектов", "Комментарии по таймкоду", "Базовые роли доступа"],
  },
  {
    name: "Рост",
    description: "Для агентств с постоянным потоком задач",
    price: 79,
    highlighted: true,
    cta: { text: "Выбрать Рост", href: "/signup" },
    features: ["До 25 активных проектов", "AI-разбор фидбека", "Отчёты по workflow"],
  },
  {
    name: "Бизнес",
    description: "Для масштабных команд и нескольких PM",
    price: 149,
    cta: { text: "Связаться с нами", href: "/signup" },
    features: ["Безлимитные проекты", "Приоритетная поддержка", "Расширенные права и аудит"],
  },
];

const faqItems = [
  {
    question: "Можно ли пригласить клиента без регистрации?",
    answer: "Да. Вы можете отправить защищённую ссылку на просмотр и комментирование конкретной версии видео.",
  },
  {
    question: "Подходит ли сервис для нескольких команд?",
    answer: "Да, в тарифах Рост и Бизнес можно параллельно вести несколько команд и клиентов.",
  },
  {
    question: "Где хранятся видеофайлы?",
    answer: "Файлы хранятся в облачном S3-хранилище с контролем доступа и безопасной выдачей ссылок.",
  },
  {
    question: "Есть ли бесплатный период?",
    answer: "Да, после регистрации вы получаете пробный доступ и можете оценить процесс на реальном проекте.",
  },
];

const footerGroups = [
  {
    title: "Продукт",
    links: [
      { label: "Возможности", href: "#features" },
      { label: "Как это работает", href: "#how-it-works" },
      { label: "Тарифы", href: "#pricing" },
    ],
  },
  {
    title: "Компания",
    links: [
      { label: "О нас", href: "#" },
      { label: "Контакты", href: "#" },
      { label: "Политика", href: "#" },
    ],
  },
  {
    title: "Поддержка",
    links: [
      { label: "FAQ", href: "#faq" },
      { label: "Документация", href: "#" },
      { label: "Помощь", href: "#" },
    ],
  },
];

export default function MarketingPage(): JSX.Element {
  return (
    <main className="min-h-screen bg-neutral-50">
      <header className="sticky top-0 z-20 border-b border-neutral-200/70 bg-white/90 backdrop-blur">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <Link href="/" className="text-lg font-semibold text-neutral-900">
            VideoFeedback
          </Link>
          <nav className="hidden items-center gap-5 text-sm text-neutral-700 md:flex">
            <a href="#features" className="hover:text-neutral-900">
              Возможности
            </a>
            <a href="#pricing" className="hover:text-neutral-900">
              Тарифы
            </a>
            <a href="#faq" className="hover:text-neutral-900">
              FAQ
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <LoginEntryButton />
            <Button size="sm" asChild>
              <Link href="/signup">Регистрация</Link>
            </Button>
          </div>
        </div>
      </header>

      <Hero
        headline="Ведите видеопроекты без хаоса в правках"
        subheadline="Собирайте комментарии по таймкоду, превращайте фидбек в задачи и ускоряйте согласование между командой и клиентом."
        primaryCTA={{ text: "Начать бесплатно", href: "/signup" }}
        secondaryCTA={{ text: "Смотреть демо", href: "#how-it-works" }}
      />

      <Features
        title="Все инструменты согласования в одном месте"
        subtitle="От первого комментария до финальной версии: прозрачный процесс для команды и клиента."
        features={features}
      />

      <HowItWorks
        title="Как это работает"
        subtitle="Три шага, чтобы ускорить производство и не терять важные правки."
        steps={steps}
      />

      <Pricing
        title="Тарифы для команд любого размера"
        subtitle="Выберите план под текущую нагрузку и масштабируйтесь по мере роста студии."
        plans={plans}
      />

      <FAQ title="Частые вопросы" subtitle="Коротко о запуске, доступах и хранении данных." items={faqItems} />

      <CTASection
        title="Готовы ускорить согласование видео?"
        description="Создайте аккаунт и запустите первый проект уже сегодня."
        primaryCTA={{ text: "Перейти к регистрации", href: "/signup" }}
      />

      <Footer
        brandName="VideoFeedback"
        description="Платформа для агентств и продакшен-команд, которые хотят сдавать проекты быстрее."
        linkGroups={footerGroups}
      />
    </main>
  );
}


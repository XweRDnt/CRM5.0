/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CTASection } from "../CTASection";
import { FAQ } from "../FAQ";
import { Features } from "../Features";
import { Footer } from "../Footer";
import { Hero } from "../Hero";
import { HowItWorks } from "../HowItWorks";
import { Pricing } from "../Pricing";

describe("Landing Components", () => {
  it("should render Hero", () => {
    render(
      <Hero
        headline="Тестовый заголовок"
        subheadline="Тестовый подзаголовок"
        primaryCTA={{ text: "Начать", href: "/signup" }}
        secondaryCTA={{ text: "Подробнее", href: "#how-it-works" }}
      />,
    );

    expect(screen.getByText("Тестовый заголовок")).not.toBeNull();
    expect(screen.getByText("Тестовый подзаголовок")).not.toBeNull();
    expect(screen.getByRole("link", { name: "Начать" }).getAttribute("href")).toBe("/signup");
  });

  it("should render Features grid", () => {
    render(
      <Features
        title="Возможности"
        subtitle="Описание"
        features={[
          { icon: <span>1</span>, title: "Фича 1", description: "Desc 1" },
          { icon: <span>2</span>, title: "Фича 2", description: "Desc 2" },
        ]}
      />,
    );

    expect(screen.getByText("Возможности")).not.toBeNull();
    expect(screen.getByText("Фича 1")).not.toBeNull();
    expect(screen.getByText("Фича 2")).not.toBeNull();
  });

  it("should render HowItWorks steps", () => {
    render(
      <HowItWorks
        title="Как это работает"
        subtitle="3 шага"
        steps={[
          { title: "Шаг 1", description: "Описание 1" },
          { title: "Шаг 2", description: "Описание 2" },
          { title: "Шаг 3", description: "Описание 3" },
        ]}
      />,
    );

    expect(screen.getByText("Шаг 1")).not.toBeNull();
    expect(screen.getByText("Шаг 2")).not.toBeNull();
    expect(screen.getByText("Шаг 3")).not.toBeNull();
  });

  it("should render Pricing plans", () => {
    render(
      <Pricing
        title="Тарифы"
        subtitle="Для всех"
        plans={[
          {
            name: "Базовый",
            description: "План",
            price: 10,
            cta: { text: "Выбрать", href: "/signup" },
            features: ["Фича A"],
          },
          {
            name: "Про",
            description: "План",
            price: 20,
            highlighted: true,
            cta: { text: "Выбрать Про", href: "/signup" },
            features: ["Фича B"],
          },
        ]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Базовый" })).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Про" })).not.toBeNull();
    expect(screen.getByText("Популярный")).not.toBeNull();
  });

  it("should render FAQ accordion items", () => {
    render(
      <FAQ
        title="FAQ"
        subtitle="Вопросы"
        items={[
          { question: "Вопрос 1", answer: "Ответ 1" },
          { question: "Вопрос 2", answer: "Ответ 2" },
        ]}
      />,
    );

    expect(screen.getByText("Вопрос 1")).not.toBeNull();
    expect(screen.getByText("Ответ 1")).not.toBeNull();
    expect(screen.getByText("Вопрос 2")).not.toBeNull();
  });

  it("should render CTA section", () => {
    render(
      <CTASection
        title="Готовы начать?"
        description="Описание"
        primaryCTA={{ text: "Регистрация", href: "/signup" }}
      />,
    );

    expect(screen.getByText("Готовы начать?")).not.toBeNull();
    expect(screen.getByRole("link", { name: "Регистрация" }).getAttribute("href")).toBe("/signup");
  });

  it("should render Footer links", () => {
    render(
      <Footer
        brandName="VideoFeedback"
        description="Описание бренда"
        linkGroups={[
          {
            title: "Продукт",
            links: [{ label: "Возможности", href: "#features" }],
          },
        ]}
      />,
    );

    expect(screen.getByText("VideoFeedback")).not.toBeNull();
    expect(screen.getByRole("link", { name: "Возможности" }).getAttribute("href")).toBe("#features");
  });
});



type Locale = "ru" | "en";

type Messages = {
  appName: string;
  nav: {
    projects: string;
    clients: string;
    closeMenu: string;
  };
  header: {
    welcome: string;
    logout: string;
  };
  auth: {
    loginTitle: string;
    loginButton: string;
    signupTitle: string;
    signupButton: string;
    noAccount: string;
    haveAccount: string;
    toSignup: string;
    toLogin: string;
  };
  portal: {
    title: string;
    leaveFeedback: string;
    recentFeedback: string;
    noFeedback: string;
    addFeedbackAtCurrentTime: string;
    selectedTime: string;
    currentTime: string;
    playerNotReady: string;
    playBeforeCapture: string;
    approveVersion: string;
    approved: string;
    approvalLocked: string;
    approveDialogTitle: string;
    approveDialogDescription: string;
    approveConfirm: string;
    cancel: string;
    approvedSuccess: string;
    approveFailed: string;
  };
  feedback: {
    authorPlaceholder: string;
    timecodePlaceholder: string;
    textPlaceholder: string;
    submit: string;
    submitting: string;
    submitSuccess: string;
    submitError: string;
  };
};

const messages: Record<Locale, Messages> = {
  ru: {
    appName: "Видео CRM",
    nav: {
      projects: "Проекты",
      clients: "Клиенты",
      closeMenu: "Закрыть меню",
    },
    header: {
      welcome: "С возвращением",
      logout: "Выйти",
    },
    auth: {
      loginTitle: "Вход",
      loginButton: "Войти",
      signupTitle: "Регистрация",
      signupButton: "Создать аккаунт",
      noAccount: "Нет аккаунта?",
      haveAccount: "Уже есть аккаунт?",
      toSignup: "Зарегистрироваться",
      toLogin: "Войти",
    },
    portal: {
      title: "Клиентский портал",
      leaveFeedback: "Оставить правки",
      recentFeedback: "Последние комментарии",
      noFeedback: "Пока нет комментариев.",
      addFeedbackAtCurrentTime: "Добавить правку на текущем времени",
      selectedTime: "Выбранное время",
      currentTime: "Текущее время",
      playerNotReady: "Плеер ещё не готов",
      playBeforeCapture: "Запустите видео и попробуйте снова",
      approveVersion: "Утвердить версию",
      approved: "Версия утверждена",
      approvalLocked: "После утверждения новые комментарии не принимаются.",
      approveDialogTitle: "Подтвердить утверждение версии?",
      approveDialogDescription: "Вы уверены? После утверждения правки не принимаются.",
      approveConfirm: "Да, утвердить",
      cancel: "Отмена",
      approvedSuccess: "Версия успешно утверждена",
      approveFailed: "Не удалось утвердить версию",
    },
    feedback: {
      authorPlaceholder: "Ваше имя",
      timecodePlaceholder: "Таймкод будет подставлен из плеера",
      textPlaceholder: "Опишите правку...",
      submit: "Отправить комментарий",
      submitting: "Отправка...",
      submitSuccess: "Комментарий отправлен",
      submitError: "Ошибка при отправке комментария",
    },
  },
  en: {
    appName: "Video CRM",
    nav: {
      projects: "Projects",
      clients: "Clients",
      closeMenu: "Close menu",
    },
    header: {
      welcome: "Welcome back",
      logout: "Logout",
    },
    auth: {
      loginTitle: "Sign In",
      loginButton: "Sign In",
      signupTitle: "Sign Up",
      signupButton: "Create Account",
      noAccount: "Don't have account?",
      haveAccount: "Already have account?",
      toSignup: "Sign up",
      toLogin: "Sign in",
    },
    portal: {
      title: "Client Portal",
      leaveFeedback: "Leave Feedback",
      recentFeedback: "Recent Feedback",
      noFeedback: "No feedback yet.",
      addFeedbackAtCurrentTime: "Add feedback at current time",
      selectedTime: "Selected time",
      currentTime: "Current time",
      playerNotReady: "Video player is not ready yet",
      playBeforeCapture: "Play the video a bit, then try again",
      approveVersion: "Approve version",
      approved: "Version approved",
      approvalLocked: "Feedback is locked after approval.",
      approveDialogTitle: "Approve this version?",
      approveDialogDescription: "Are you sure? Feedback will be locked after approval.",
      approveConfirm: "Yes, approve",
      cancel: "Cancel",
      approvedSuccess: "Version approved",
      approveFailed: "Failed to approve version",
    },
    feedback: {
      authorPlaceholder: "Your Name",
      timecodePlaceholder: "Timecode will be set from the video button",
      textPlaceholder: "Share your feedback...",
      submit: "Submit Feedback",
      submitting: "Submitting...",
      submitSuccess: "Feedback submitted",
      submitError: "Error submitting feedback",
    },
  },
};

export function getMessages(locale: Locale = "ru"): Messages {
  return messages[locale] ?? messages.ru;
}


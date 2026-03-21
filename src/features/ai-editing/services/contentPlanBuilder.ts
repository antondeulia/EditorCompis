import { RequestAnalysis, getAspectRatioLabel, sanitizeText } from "./requestAnalysis";

export interface StoryboardBlueprint {
  title: string;
  body: string;
  list: string[];
  narration: string;
  accentPreset: string;
  designIntent: string;
  motionNote: string;
  visual: string;
}

interface PlanningSignals {
  mentionsHistory: boolean;
  mentionsGuide: boolean;
  mentionsComparison: boolean;
  mentionsRisks: boolean;
  mentionsFuture: boolean;
}

const detectPlanningSignals = (userMessage: string): PlanningSignals => {
  const message = userMessage.toLowerCase();

  return {
    mentionsHistory: /history|timeline|milestone|origin|evolution|chronology|истори|эволюц|этап|таймлайн|хронолог/i.test(
      message,
    ),
    mentionsGuide: /trade|buy|sell|use|workflow|guide|how to|tutorial|step|пошаг|как |использ|примен|гайд|инструкц/i.test(
      message,
    ),
    mentionsComparison: /versus|vs|compare|comparison|difference|against|сравн|против|разниц/i.test(message),
    mentionsRisks: /risk|volatil|danger|concern|pros and cons|trade-off|risk reward|риск|волатил|опас|плюс|минус/i.test(
      message,
    ),
    mentionsFuture: /future|outlook|forecast|next|what happens next|перспектив|будущ|дальше|прогноз/i.test(message),
  };
};

export const createSceneLabel = (index: number, language: RequestAnalysis["language"]) => {
  const labels =
    language === "ru"
      ? ["ХУК", "ОСНОВА", "МЕХАНИКА", "СМЫСЛ", "ПРАКТИКА", "ФИНАЛ"]
      : ["HOOK", "BASE", "MECHANICS", "VALUE", "PRACTICE", "FINALE"];

  return labels[index] ?? (language === "ru" ? "СЦЕНА" : "SCENE");
};

const buildRussianBlueprints = ({
  topic,
  aspectLabel,
  backgroundSummary,
  signals,
}: {
  topic: string;
  aspectLabel: string;
  backgroundSummary: string;
  signals: PlanningSignals;
}): StoryboardBlueprint[] => {
  const sceneThreeTitle = signals.mentionsHistory
    ? `Как развивался ${topic}`
    : signals.mentionsComparison
      ? `${topic} на фоне альтернатив`
      : `Как работает ${topic}`;

  const sceneThreeBody = signals.mentionsHistory
    ? "Покажи развитие темы через 3 ключевых этапа, чтобы зритель понял не только факт, но и траекторию изменений."
    : signals.mentionsComparison
      ? "Разложи тему через контраст: что в ней принципиально отличается и почему это отличие важно."
      : "Собери механику темы в короткую понятную последовательность, которую можно считать за несколько секунд.";

  const sceneThreeList = signals.mentionsHistory
    ? ["старт", "переломный момент", "текущее состояние"]
    : signals.mentionsComparison
      ? ["старый подход", "что меняется", "главное отличие"]
      : ["вход", "процесс", "результат"];

  const sceneThreeNarration = signals.mentionsHistory
    ? `Поясни, как ${topic} менялся со временем и почему именно эти этапы сформировали текущее восприятие темы.`
    : signals.mentionsComparison
      ? `Сравни ${topic} с привычной альтернативой так, чтобы зритель быстро увидел разницу по сути, а не по набору терминов.`
      : `Покажи логику ${topic} как цепочку из нескольких шагов, а не как плотный абзац текста.`;

  const sceneThreeVisual = signals.mentionsHistory
    ? "короткая линия времени с тремя маркерами и акцентом на переломный этап"
    : signals.mentionsComparison
      ? "двухколоночное сравнение с явным визуальным контрастом"
      : "схема из модулей или стрелок, которая показывает причинно-следственную связь";

  const sceneFourTitle = signals.mentionsRisks ? "Где сила и где риск" : `Почему ${topic} вообще важен`;
  const sceneFourBody = signals.mentionsRisks
    ? "Собери сцену как честный баланс: что даёт тема, где возникает напряжение, и почему вокруг неё столько споров."
    : "Переведи тему из абстракции в последствия: что меняется на практике и почему к ней возвращаются снова.";
  const sceneFourList = signals.mentionsRisks
    ? ["потенциал", "ограничение", "главный спор"]
    : ["что меняется", "для кого это важно", "где ценность"];
  const sceneFourNarration = signals.mentionsRisks
    ? `Раскрой ${topic} без упрощений: покажи выгоду, слабое место и напряжение между ними.`
    : `Объясни, почему ${topic} важен не как идея сама по себе, а как фактор, который влияет на реальные решения и ожидания.`;
  const sceneFourVisual = signals.mentionsRisks
    ? "контрастный split-screen с двумя полюсами и напряжением между ними"
    : "сравнение до и после или две состояния в одной рамке";

  const sceneFiveTitle = signals.mentionsGuide
    ? `Как подступиться к ${topic}`
    : signals.mentionsFuture
      ? `Что дальше у ${topic}`
      : `${topic} в реальном сценарии`;
  const sceneFiveBody = signals.mentionsGuide
    ? "Перейди от объяснения к действию: дай короткую последовательность, по которой зритель понимает первый практический шаг."
    : signals.mentionsFuture
      ? "Собери сцену вокруг тренда и неопределённости: что уже видно сейчас и за чем имеет смысл следить дальше."
      : "Приземли тему на живой пример, чтобы зритель увидел, как она ощущается вне теории.";
  const sceneFiveList = signals.mentionsGuide
    ? ["с чего начать", "на что смотреть", "чего не делать сразу"]
    : signals.mentionsFuture
      ? ["текущий тренд", "открытый вопрос", "что наблюдать дальше"]
      : ["контекст", "что происходит", "какой эффект получается"];
  const sceneFiveNarration = signals.mentionsGuide
    ? `Покажи ${topic} как понятную стартовую последовательность, где зритель видит первый шаг и ключевую осторожность.`
    : signals.mentionsFuture
      ? `Сформулируй, куда может двигаться ${topic}, не обещая лишнего и оставляя зрителю ясный ориентир.`
      : `Переведи ${topic} в конкретный сценарий, чтобы тема перестала быть абстрактной и стала наблюдаемой.`;
  const sceneFiveVisual = signals.mentionsGuide
    ? "карточки шагов и callout на ключевом действии"
    : signals.mentionsFuture
      ? "направляющая диаграмма или ростовая линия с зоной неопределённости"
      : "сценарная карточка с опорными состояниями и акцентом на результате";

  return [
    {
      title: `${topic}: с чего начать понимание`,
      body: "Открой тему через главный угол зрения: не просто назови объект, а сразу задай вопрос, почему зрителю стоит досмотреть дальше.",
      list: ["что это за тема", "почему вокруг неё внимание", "что разберём дальше"],
      narration: `Открой ролик так, чтобы ${topic} сразу считывался как значимая тема, а не как случайный термин без контекста.`,
      accentPreset: "Solid Rectangle",
      designIntent: `Первая сцена в формате ${aspectLabel} на фоне ${backgroundSummary}: сильный заголовок, ясная иерархия, ощущение редакционного вступления.`,
      motionNote: "Сначала входит заголовок, затем короткая подводка, а графический блок лишь поддерживает тезис, а не спорит с ним.",
      visual: "крупный символ темы или метафорическая геометрия, которая задаёт контекст",
    },
    {
      title: `Что такое ${topic} на самом деле`,
      body: "Дай простое определение без канцелярита: одна главная мысль, одна расшифровка и короткий вывод, за который можно зацепиться.",
      list: ["простое определение", "в чём суть", "какой базовый принцип"],
      narration: `Объясни ${topic} простыми словами и убери всё лишнее, чтобы зритель понял ядро идеи без перегруза.`,
      accentPreset: "Circle Pulse",
      designIntent: "Сцена-расшифровка с плотной типографикой, короткой подводкой и визуалом, который помогает понять смысл, а не просто украшает кадр.",
      motionNote: "Лейбл задаёт тон, затем появляется тезис, после чего вспомогательный графический акцент мягко закрепляет смысл.",
      visual: "иконографический или концептуальный placeholder, который визуально объясняет природу темы",
    },
    {
      title: sceneThreeTitle,
      body: sceneThreeBody,
      list: sceneThreeList,
      narration: sceneThreeNarration,
      accentPreset: "Triangle Marker",
      designIntent: "Опорная объясняющая сцена, где смысл читается по структуре, а не теряется в длинном текстовом блоке.",
      motionNote: "Ведущий маркер появляется первым, затем информация раскрывается по шагам, чтобы взгляд шёл по заданной траектории.",
      visual: sceneThreeVisual,
    },
    {
      title: sceneFourTitle,
      body: sceneFourBody,
      list: sceneFourList,
      narration: sceneFourNarration,
      accentPreset: "Split Screen",
      designIntent: "Сцена со ставкой или конфликтом, построенная на сопоставлении двух состояний или двух точек зрения.",
      motionNote: "Кадр собирается как чистое сравнение: две зоны входят по очереди и быстро создают смысловой контраст.",
      visual: sceneFourVisual,
    },
    {
      title: sceneFiveTitle,
      body: sceneFiveBody,
      list: sceneFiveList,
      narration: sceneFiveNarration,
      accentPreset: "Callout Bubble",
      designIntent: "Практическая или прогнозная сцена с понятной точкой фокуса и ощущением реального применения темы.",
      motionNote: "Блоки входят последовательно, а callout подчёркивает деталь, которую зритель должен вынести из сцены.",
      visual: sceneFiveVisual,
    },
    {
      title: `Что важно запомнить про ${topic}`,
      body: "Закрой ролик через один главный вывод и несколько коротких опор, чтобы финал ощущался собранным и уверенным.",
      list: ["главный takeaway", "частая ошибка", "финальная мысль"],
      narration: `Собери финал так, чтобы после ролика про ${topic} у зрителя осталась одна чёткая мысль, а не россыпь несвязанных фактов.`,
      accentPreset: "Arrow Swipe",
      designIntent: "Финальная сцена с одним сильным выводом, направляющим акцентом и плотным завершением композиции.",
      motionNote: "Сначала появляется финальный тезис, затем быстро садятся опорные пункты, а направляющий акцент закрывает ритм ролика.",
      visual: "финальный направляющий акцент, символ или графический знак завершения",
    },
  ];
};

const buildEnglishBlueprints = ({
  topic,
  aspectLabel,
  backgroundSummary,
  signals,
}: {
  topic: string;
  aspectLabel: string;
  backgroundSummary: string;
  signals: PlanningSignals;
}): StoryboardBlueprint[] => {
  const sceneThreeTitle = signals.mentionsHistory
    ? `How ${topic} evolved`
    : signals.mentionsComparison
      ? `${topic} versus the usual alternative`
      : `How ${topic} works`;

  const sceneThreeBody = signals.mentionsHistory
    ? "Show the topic through a short sequence of milestones so the audience can understand movement, not just facts."
    : signals.mentionsComparison
      ? "Build the explanation through contrast so the difference becomes visible immediately."
      : "Turn the mechanism into a short readable chain so the logic is clear at a glance.";

  const sceneThreeList = signals.mentionsHistory
    ? ["starting point", "turning point", "current phase"]
    : signals.mentionsComparison
      ? ["usual model", "what changes", "key difference"]
      : ["input", "process", "result"];

  const sceneThreeNarration = signals.mentionsHistory
    ? `Show how ${topic} changed over time so the viewer can connect the present version to the milestones that shaped it.`
    : signals.mentionsComparison
      ? `Compare ${topic} with the familiar alternative so the audience sees the difference in practical terms instead of jargon.`
      : `Break ${topic} into a small sequence of steps so the mechanism reads clearly instead of feeling dense.`;

  const sceneThreeVisual = signals.mentionsHistory
    ? "short milestone timeline with one clearly emphasized turning point"
    : signals.mentionsComparison
      ? "two-panel comparison with a strong visual contrast"
      : "modular process diagram with arrows or connected blocks";

  const sceneFourTitle = signals.mentionsRisks ? "Where the upside meets the risk" : `Why ${topic} matters`;
  const sceneFourBody = signals.mentionsRisks
    ? "Treat the scene as a balanced tension point: what the topic offers, what can break, and why people disagree."
    : "Translate the subject into impact so it feels consequential rather than purely abstract.";
  const sceneFourList = signals.mentionsRisks
    ? ["upside", "trade-off", "main concern"]
    : ["what changes", "why people care", "where the value shows"];
  const sceneFourNarration = signals.mentionsRisks
    ? `Explain ${topic} honestly by showing the upside, the weak point, and the tension between them.`
    : `Show why ${topic} matters by connecting it to outcomes, incentives, or decisions the audience already understands.`;
  const sceneFourVisual = signals.mentionsRisks
    ? "split-screen tension graphic with two opposing states"
    : "before-versus-after frame or contrast between two states";

  const sceneFiveTitle = signals.mentionsGuide
    ? `How to approach ${topic}`
    : signals.mentionsFuture
      ? `What may happen next with ${topic}`
      : `${topic} in a real example`;
  const sceneFiveBody = signals.mentionsGuide
    ? "Shift from explanation to action with a short sequence that makes the first move feel clear and usable."
    : signals.mentionsFuture
      ? "Center the scene on a visible trend, an open question, and the signal worth watching next."
      : "Ground the topic in a recognisable scenario so the concept becomes tangible.";
  const sceneFiveList = signals.mentionsGuide
    ? ["first move", "what to watch", "common mistake"]
    : signals.mentionsFuture
      ? ["visible trend", "open question", "next signal"]
      : ["context", "what changes", "what the result looks like"];
  const sceneFiveNarration = signals.mentionsGuide
    ? `Turn ${topic} into a practical starting sequence so the viewer can imagine taking the first step immediately.`
    : signals.mentionsFuture
      ? `Frame where ${topic} may be heading without overpromising certainty, and leave the viewer with a concrete watchpoint.`
      : `Show ${topic} through a real scenario so the audience can picture how it behaves outside theory.`;
  const sceneFiveVisual = signals.mentionsGuide
    ? "step cards with a highlighted action callout"
    : signals.mentionsFuture
      ? "directional trend line with one uncertain zone"
      : "scenario card with a clear state change";

  return [
    {
      title: `${topic}: why people keep paying attention`,
      body: "Open with the main angle on the subject so the viewer immediately knows why this topic is worth following.",
      list: ["what the topic is", "why it gets attention", "where the video is going"],
      narration: `Open the piece so ${topic} lands as a meaningful subject right away instead of a vague label.`,
      accentPreset: "Solid Rectangle",
      designIntent: `Opening scene in ${aspectLabel} with ${backgroundSummary}, strong hierarchy, and a clear editorial hook.`,
      motionNote: "The headline lands first, support copy follows, and the visual block reinforces the thesis rather than competing with it.",
      visual: "large thematic symbol or metaphor-driven geometric hero",
    },
    {
      title: `What ${topic} actually is`,
      body: "Define the subject in plain language with one core thought, one clarification, and one useful takeaway.",
      list: ["plain-language definition", "what makes it distinct", "core principle"],
      narration: `Explain ${topic} simply and keep the frame focused on only the information that helps understanding.`,
      accentPreset: "Circle Pulse",
      designIntent: "Definition scene with measured typography and a supporting visual that carries explanatory weight.",
      motionNote: "A short kicker sets the rhythm, the main thesis follows, and the supporting accent settles in softly.",
      visual: "iconographic or conceptual placeholder visual that explains the idea",
    },
    {
      title: sceneThreeTitle,
      body: sceneThreeBody,
      list: sceneThreeList,
      narration: sceneThreeNarration,
      accentPreset: "Triangle Marker",
      designIntent: "Core explanatory scene where structure does the heavy lifting and keeps the topic easy to scan.",
      motionNote: "The lead marker appears first, then information unfolds in sequence so the eye follows a deliberate path.",
      visual: sceneThreeVisual,
    },
    {
      title: sceneFourTitle,
      body: sceneFourBody,
      list: sceneFourList,
      narration: sceneFourNarration,
      accentPreset: "Split Screen",
      designIntent: "Stakes or value scene designed around contrast between two states, two outcomes, or two points of view.",
      motionNote: "The frame assembles as a clean comparison so the viewer can read the tension or value quickly.",
      visual: sceneFourVisual,
    },
    {
      title: sceneFiveTitle,
      body: sceneFiveBody,
      list: sceneFiveList,
      narration: sceneFiveNarration,
      accentPreset: "Callout Bubble",
      designIntent: "Practical or forward-looking scene with a clear focal point and an obvious reason for the viewer to care.",
      motionNote: "The blocks enter in a calm sequence and the callout highlights the exact detail that should stick.",
      visual: sceneFiveVisual,
    },
    {
      title: `What to remember about ${topic}`,
      body: "Close on one strong takeaway and a few support points so the ending feels decisive rather than overloaded.",
      list: ["main takeaway", "common misconception", "final frame"],
      narration: `Close the video on ${topic} with one strong idea the viewer can keep after everything else is gone.`,
      accentPreset: "Arrow Swipe",
      designIntent: "Closing scene built around a decisive final statement and a directional accent that resolves the sequence.",
      motionNote: "The closing line appears with confidence, the support points settle quickly, and the directional accent closes the rhythm cleanly.",
      visual: "final directional accent or closing symbol",
    },
  ];
};

export const buildSceneBlueprints = (analysis: RequestAnalysis, userMessage: string): StoryboardBlueprint[] => {
  const topic = sanitizeText(analysis.topic, analysis.language === "ru" ? "тема" : "the topic");
  const aspectLabel = analysis.aspectRatioLabel ?? getAspectRatioLabel(16 / 9);
  const backgroundSummary = analysis.backgroundSummary;
  const signals = detectPlanningSignals(userMessage);

  return analysis.language === "ru"
    ? buildRussianBlueprints({ topic, aspectLabel, backgroundSummary, signals })
    : buildEnglishBlueprints({ topic, aspectLabel, backgroundSummary, signals });
};


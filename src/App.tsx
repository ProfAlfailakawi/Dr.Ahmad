import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Check,
  Gamepad2,
  Home,
  Keyboard,
  Maximize2,
  Mic2,
  MicOff,
  Music2,
  Play,
  Radio,
  RotateCcw,
  Settings2,
  Sparkles,
  Star,
  Trophy,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import { audioEngine } from "./galaxyAudio";
import { Lulu, type LuluMood } from "./components/ui/Lulu";
import { MotionGame } from "./components/MotionGame";
import {
  PLAYERS,
  createSessionSeed,
  generateChallenge,
  type Challenge,
  type Choice,
  type MemoryCard,
  type PlayerId,
} from "./galaxyEngine";

type Screen = "home" | "countdown" | "game" | "summary";
type ModeId = "family" | "quick" | "endless";
type RoundPhase = "playing" | "success";

// الصوت إنجليزي حماسي (الواجهة تبقى عربية). أسماء البنات بالإنجليزي.
const EN_NAME: Record<string, string> = { basma: "Basma", durra: "Durrah", azyan: "Azian", family: "team" };
const enName = (id: string): string => EN_NAME[id] ?? "champion";
const CHEER_EN = (n: string): string[] => [
  `Bravo, ${n}!`,
  `Wow ${n}, you're a superstar!`,
  `Yes ${n}! Amazing!`,
  `Awesome job, ${n}! High five!`,
];
const pickEn = (arr: string[]): string => arr[Math.floor(Math.random() * arr.length)]!;

interface ModeConfig {
  id: ModeId;
  title: string;
  eyebrow: string;
  description: string;
  rounds: number | null;
  duration: string;
  icon: string;
}

interface GalaxyStats {
  version: 3;
  totalStars: number;
  bestScore: number;
  bestStreak: number;
  sessions: number;
}

interface GalaxySettings {
  music: boolean;
  sound: boolean;
  speech: boolean;
}

interface WakeLockLike {
  release: () => Promise<void>;
}

const MODES: readonly ModeConfig[] = [
  {
    id: "family",
    title: "المغامرة الكبرى",
    eyebrow: "الأفضل للعائلة",
    description: "أدوار متوازنة ومهمة عائلية كل أربع جولات",
    rounds: 12,
    duration: "١٢ جولة",
    icon: "🚀",
  },
  {
    id: "quick",
    title: "برق × ٦",
    eyebrow: "جاهزة بسرعة",
    description: "ست جولات مركزة قبل النوم أو قبل الخروج",
    rounds: 6,
    duration: "٦ جولات",
    icon: "⚡",
  },
  {
    id: "endless",
    title: "الوضع الخارق ∞",
    eyebrow: "بلا نهاية",
    description: "عوالم ومراحل تتولّد لحظياً إلى أن تقولوا كافي",
    rounds: null,
    duration: "على كيفكم",
    icon: "🌌",
  },
] as const;

const PLAYER_COLORS: Record<PlayerId, string> = {
  basma: "#ffd166",
  durra: "#53e4ff",
  azyan: "#bd8cff",
  family: "#ff7f9f",
};

const STATS_KEY = "our_family_galaxy_stats_v3";
const SETTINGS_KEY = "our_family_galaxy_settings_v3";

const DEFAULT_STATS: GalaxyStats = {
  version: 3,
  totalStars: 0,
  bestScore: 0,
  bestStreak: 0,
  sessions: 0,
};

const DEFAULT_SETTINGS: GalaxySettings = {
  music: true,
  sound: true,
  speech: true,
};

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function playerFor(id: PlayerId) {
  return PLAYERS.find((player) => player.id === id) ?? PLAYERS[3]!;
}

function modeFor(id: ModeId) {
  return MODES.find((mode) => mode.id === id) ?? MODES[0];
}

function greetingForNow() {
  const hour = new Date().getHours();
  if (hour < 12) return "صباح المغامرة";
  if (hour < 18) return "عصر التحديات";
  return "ليلة النجوم";
}

function weekdayLabel() {
  try {
    return new Intl.DateTimeFormat("ar-KW", { weekday: "long" }).format(new Date());
  } catch {
    return "اليوم";
  }
}

function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [selectedMode, setSelectedMode] = useState<ModeId>("family");
  const [activeMode, setActiveMode] = useState<ModeId>("family");
  const [seed, setSeed] = useState(() => createSessionSeed());
  const [round, setRound] = useState(1);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [sessionBestStreak, setSessionBestStreak] = useState(0);
  const [phase, setPhase] = useState<RoundPhase>("playing");
  const [motionOpen, setMotionOpen] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<GalaxySettings>(() =>
    readStorage(SETTINGS_KEY, DEFAULT_SETTINGS),
  );
  const [stats, setStats] = useState<GalaxyStats>(() =>
    readStorage(STATS_KEY, DEFAULT_STATS),
  );
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));
  const [gamepadConnected, setGamepadConnected] = useState(false);
  const [wrongChoice, setWrongChoice] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [hintVisible, setHintVisible] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [sequenceDone, setSequenceDone] = useState<string[]>([]);
  const [flippedCards, setFlippedCards] = useState<string[]>([]);
  const [matchedPairs, setMatchedPairs] = useState<string[]>([]);
  const [familyRunning, setFamilyRunning] = useState(false);
  const [familyTime, setFamilyTime] = useState(10);

  const resultTimer = useRef<number | null>(null);
  const wrongTimer = useRef<number | null>(null);
  const memoryTimer = useRef<number | null>(null);
  const promptTimer = useRef<number | null>(null);
  const wakeLock = useRef<WakeLockLike | null>(null);
  const wakeGeneration = useRef(0);
  const completionLock = useRef(false);
  const sequenceDoneRef = useRef<string[]>([]);
  const flippedCardsRef = useRef<string[]>([]);
  const matchedPairsRef = useRef<string[]>([]);
  const memoryLockedRef = useRef(false);
  const settingsPanelRef = useRef<HTMLElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const activeModeConfig = modeFor(activeMode);
  const challenge = useMemo(() => generateChallenge(round, seed), [round, seed]);
  const activePlayer = playerFor(challenge.playerId);
  const luluMood: LuluMood = phase === "success" ? "cheer" : wrongChoice ? "oops" : hintVisible ? "think" : "idle";
  const hintText = useMemo(() => {
    if (challenge.kind === "choice") {
      const answer = challenge.choices?.find((choice) => choice.id === challenge.correctId);
      return answer ? `تلميح: ابحثوا عن ${answer.emoji ? `${answer.emoji} ${answer.label}` : answer.label}.` : "استبعدوا الخيارات التي لا تناسب السؤال.";
    }
    if (challenge.kind === "sequence") {
      const nextId = challenge.sequence?.[sequenceDone.length];
      const next = challenge.choices?.find((choice) => choice.id === nextId);
      return next ? `الخطوة التالية هي ${next.label}.` : "ابدؤوا بالأصغر ثم تقدّموا خطوة خطوة.";
    }
    if (challenge.kind === "memory") return "اختاروا بطاقة، ورددوا اسم صورتها بصوت عالٍ حتى تتذكروا مكانها.";
    return "اختاروا قائداً واحداً، والباقون يقلدونه في الوقت نفسه.";
  }, [challenge, sequenceDone.length]);
  // During the success phase `streak` already includes the round just won.
  // The awarded combo used the previous streak, so subtract one for display.
  const comboReward = challenge.reward + Math.min(4, Math.max(0, streak - 1));
  const progress = activeModeConfig.rounds
    ? Math.min(100, ((round - 1) / activeModeConfig.rounds) * 100)
    : ((round - 1) % 10) * 10;

  const worldStyle = {
    "--world-from": challenge.world.palette.from,
    "--world-via": challenge.world.palette.via,
    "--world-to": challenge.world.palette.to,
    "--world-accent": challenge.world.palette.accent,
    "--player-color": PLAYER_COLORS[challenge.playerId],
  } as CSSProperties;

  useEffect(() => {
    audioEngine.setMusicEnabled(settings.music);
    audioEngine.setSoundEnabled(settings.sound);
    audioEngine.setSpeechEnabled(settings.speech);
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // Private browsing can deny storage; the current session still works.
    }
  }, [settings]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STATS_KEY, JSON.stringify(stats));
    } catch {
      // Progress stays in memory when storage is unavailable.
    }
  }, [stats]);

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  useEffect(() => {
    return () => {
      if (resultTimer.current) window.clearTimeout(resultTimer.current);
      if (wrongTimer.current) window.clearTimeout(wrongTimer.current);
      if (memoryTimer.current) window.clearTimeout(memoryTimer.current);
      if (promptTimer.current) window.clearTimeout(promptTimer.current);
      wakeGeneration.current += 1;
      void wakeLock.current?.release().catch(() => undefined);
      audioEngine.stop();
    };
  }, []);

  useEffect(() => {
    if (screen !== "countdown") return;

    setCountdown(3);
    audioEngine.countdown();
    const timers = [
      window.setTimeout(() => setCountdown(2), 420),
      window.setTimeout(() => setCountdown(1), 840),
      window.setTimeout(() => setCountdown(0), 1260),
      window.setTimeout(() => {
        audioEngine.whoosh();
        setScreen("game");
      }, 1680),
    ];
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [screen, seed]);

  useEffect(() => {
    if (screen !== "game") return;
    completionLock.current = false;
    sequenceDoneRef.current = [];
    flippedCardsRef.current = [];
    matchedPairsRef.current = [];
    memoryLockedRef.current = false;
    setPhase("playing");
    setWrongChoice(null);
    setAttempts(0);
    setHintVisible(false);
    setStatusMessage("");
    setSequenceDone([]);
    setFlippedCards([]);
    setMatchedPairs([]);
    setFamilyRunning(false);
    setFamilyTime(Math.min(24, Math.max(16, Math.round(challenge.duration / 2.5))));
    audioEngine.setMood("play");

    if (promptTimer.current) window.clearTimeout(promptTimer.current);
    promptTimer.current = window.setTimeout(() => {
      // نداء الدور بصوت إنجليزي حماسي.
      audioEngine.speak(`Your turn, ${enName(challenge.playerId)}! Look carefully!`);
    }, 420);
    return () => {
      if (promptTimer.current) window.clearTimeout(promptTimer.current);
    };
  }, [challenge.id, challenge.duration, challenge.playerId, screen]);

  useEffect(() => {
    if (screen !== "game" || !familyRunning || settingsOpen || phase !== "playing" || challenge.kind !== "family") return;
    if (familyTime <= 0) return;
    const timer = window.setTimeout(() => setFamilyTime((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [challenge.kind, familyRunning, familyTime, phase, screen, settingsOpen]);

  const requestWakeLock = useCallback(async (generation: number) => {
    const navigatorWithWakeLock = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<WakeLockLike> };
    };
    try {
      const nextLock = await navigatorWithWakeLock.wakeLock?.request("screen") ?? null;
      if (generation !== wakeGeneration.current) {
        await nextLock?.release().catch(() => undefined);
        return;
      }
      void wakeLock.current?.release().catch(() => undefined);
      wakeLock.current = nextLock;
    } catch {
      if (generation === wakeGeneration.current) wakeLock.current = null;
    }
  }, []);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && (screen === "game" || screen === "countdown")) {
        void requestWakeLock(wakeGeneration.current);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [requestWakeLock, screen]);

  const finishSession = useCallback((finalScore: number, finalBestStreak: number) => {
    setStats((current) => ({
      ...current,
      sessions: current.sessions + 1,
      bestScore: Math.max(current.bestScore, finalScore),
      bestStreak: Math.max(current.bestStreak, finalBestStreak),
    }));
    audioEngine.setMood("victory");
    audioEngine.speak("Bravo! You are the best team in the whole galaxy!");
    setScreen("summary");
  }, []);

  const completeChallenge = useCallback(() => {
    if (phase !== "playing" || completionLock.current) return;
    completionLock.current = true;
    if (promptTimer.current) {
      window.clearTimeout(promptTimer.current);
      promptTimer.current = null;
    }

    const nextStreak = streak + 1;
    const earned = challenge.reward + Math.min(4, Math.max(0, streak));
    const nextScore = score + earned;
    const nextBestStreak = Math.max(sessionBestStreak, nextStreak);
    setPhase("success");
    setStreak(nextStreak);
    setSessionBestStreak(nextBestStreak);
    setScore(nextScore);
    setStats((current) => ({
      ...current,
      totalStars: current.totalStars + earned,
      bestScore: Math.max(current.bestScore, nextScore),
      bestStreak: Math.max(current.bestStreak, nextBestStreak),
    }));
    audioEngine.success();
    // تهنئة بصوت إنجليزي حماسي باسم الطفلة.
    audioEngine.speak(pickEn(CHEER_EN(enName(challenge.playerId))));

    if (resultTimer.current) window.clearTimeout(resultTimer.current);
    resultTimer.current = window.setTimeout(() => {
      if (activeModeConfig.rounds !== null && round >= activeModeConfig.rounds) {
        finishSession(nextScore, nextBestStreak);
        return;
      }
      setRound((value) => value + 1);
    }, 2250);
  }, [
    activeModeConfig.rounds,
    challenge.celebration,
    challenge.reward,
    finishSession,
    phase,
    round,
    score,
    sessionBestStreak,
    streak,
  ]);

  useEffect(() => {
    if (
      screen === "game" &&
      challenge.kind === "family" &&
      familyRunning &&
      familyTime === 0 &&
      !settingsOpen &&
      phase === "playing"
    ) {
      completeChallenge();
    }
  }, [challenge.kind, completeChallenge, familyRunning, familyTime, phase, screen, settingsOpen]);

  const showGentleMiss = useCallback((id: string) => {
    setWrongChoice(id);
    setStreak(0);
    setAttempts((value) => value + 1);
    setStatusMessage("قريبين! جرّبوا مرة ثانية، ما عندنا خسارة.");
    audioEngine.wrong();
    audioEngine.speak(`Almost, ${enName(challenge.playerId)}! Try again, you can do it!`);
    if (wrongTimer.current) window.clearTimeout(wrongTimer.current);
    wrongTimer.current = window.setTimeout(() => {
      setWrongChoice(null);
      setStatusMessage("");
    }, 1100);
  }, [challenge.playerId]);

  const showHint = useCallback(() => {
    setHintVisible(true);
    setStatusMessage(hintText);
    audioEngine.tap();
    audioEngine.speak("Here's a little hint! You can do it!");
  }, [hintText]);

  const chooseAnswer = useCallback((choice: Choice) => {
    if (phase !== "playing") return;
    audioEngine.tap();
    if (choice.id === challenge.correctId) completeChallenge();
    else showGentleMiss(choice.id);
  }, [challenge.correctId, completeChallenge, phase, showGentleMiss]);

  const chooseSequence = useCallback((choice: Choice) => {
    const completed = sequenceDoneRef.current;
    if (phase !== "playing" || completed.includes(choice.id)) return;
    const expected = challenge.sequence?.[completed.length];
    audioEngine.tap();
    if (choice.id !== expected) {
      showGentleMiss(choice.id);
      return;
    }
    const next = [...completed, choice.id];
    sequenceDoneRef.current = next;
    setSequenceDone(next);
    if (next.length === challenge.sequence?.length) completeChallenge();
  }, [challenge.sequence, completeChallenge, phase, showGentleMiss]);

  const chooseMemoryCard = useCallback((card: MemoryCard) => {
    if (
      phase !== "playing" ||
      memoryLockedRef.current ||
      flippedCardsRef.current.includes(card.id) ||
      matchedPairsRef.current.includes(card.pairId)
    ) return;

    audioEngine.tap();
    const visibleCards = flippedCardsRef.current;
    if (visibleCards.length === 0) {
      flippedCardsRef.current = [card.id];
      setFlippedCards([card.id]);
      return;
    }

    const firstCard = challenge.cards?.find((candidate) => candidate.id === visibleCards[0]);
    if (!firstCard) {
      flippedCardsRef.current = [card.id];
      setFlippedCards([card.id]);
      return;
    }

    flippedCardsRef.current = [firstCard.id, card.id];
    memoryLockedRef.current = true;
    setFlippedCards([firstCard.id, card.id]);
    const isMatch = firstCard.pairId === card.pairId;
    memoryTimer.current = window.setTimeout(() => {
      if (isMatch) {
        const nextPairs = [...matchedPairsRef.current, card.pairId];
        matchedPairsRef.current = nextPairs;
        setMatchedPairs(nextPairs);
        const pairCount = new Set((challenge.cards ?? []).map((item) => item.pairId)).size;
        if (nextPairs.length === pairCount) completeChallenge();
      } else {
        audioEngine.wrong();
        setStreak(0);
      }
      flippedCardsRef.current = [];
      memoryLockedRef.current = false;
      setFlippedCards([]);
    }, isMatch ? 450 : 720);
  }, [
    challenge.cards,
    completeChallenge,
    phase,
  ]);

  const startSession = useCallback((modeId: ModeId = selectedMode) => {
    const nextSeed = createSessionSeed();
    const generation = wakeGeneration.current + 1;
    wakeGeneration.current = generation;
    completionLock.current = false;
    void wakeLock.current?.release().catch(() => undefined);
    wakeLock.current = null;
    setActiveMode(modeId);
    setSelectedMode(modeId);
    setSeed(nextSeed);
    setRound(1);
    setScore(0);
    setStreak(0);
    setSessionBestStreak(0);
    setPhase("playing");
    setScreen("countdown");
    setSettingsOpen(false);
    void audioEngine.start();
    audioEngine.setMood("play");
    audioEngine.speak("Get ready, Azian, Durrah, and Basma! Let's go!");
    void requestWakeLock(generation);
  }, [requestWakeLock, selectedMode]);

  const goHome = useCallback(() => {
    if (resultTimer.current) window.clearTimeout(resultTimer.current);
    if (wrongTimer.current) window.clearTimeout(wrongTimer.current);
    if (memoryTimer.current) window.clearTimeout(memoryTimer.current);
    if (promptTimer.current) window.clearTimeout(promptTimer.current);
    wakeGeneration.current += 1;
    completionLock.current = false;
    setFamilyRunning(false);
    if (screen === "game" && round > 1) {
      setStats((current) => ({
        ...current,
        sessions: current.sessions + 1,
        bestScore: Math.max(current.bestScore, score),
      }));
    }
    setScreen("home");
    setPhase("playing");
    audioEngine.setMood("lobby");
    void wakeLock.current?.release().catch(() => undefined);
    wakeLock.current = null;
  }, [round, score, screen]);

  const toggleFullscreen = useCallback(() => {
    void audioEngine.start();
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    } else {
      void document.documentElement.requestFullscreen?.().catch(() => undefined);
    }
  }, []);

  const repeatPrompt = useCallback(() => {
    void audioEngine.start();
    audioEngine.tap();
    audioEngine.speak(`Come on ${enName(challenge.playerId)}, look and pick the right one!`);
  }, [challenge.playerId]);

  const openSettings = useCallback(() => {
    void audioEngine.start();
    audioEngine.tap();
    setSettingsOpen(true);
  }, []);

  useEffect(() => {
    if (!settingsOpen) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const focusTimer = window.setTimeout(() => {
      settingsPanelRef.current?.querySelector<HTMLButtonElement>("button:not([disabled])")?.focus();
    }, 0);
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !settingsPanelRef.current) return;
      const buttons = (
        Array.from(
          settingsPanelRef.current.querySelectorAll<HTMLButtonElement>("button:not([disabled])"),
        ) as HTMLButtonElement[]
      ).filter((button) => button.offsetParent !== null);
      if (!buttons.length) return;
      const first = buttons[0]!;
      const last = buttons[buttons.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", trapFocus);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", trapFocus);
      previousFocusRef.current?.focus();
    };
  }, [settingsOpen]);

  useEffect(() => {
    if (screen !== "game" || settingsOpen || phase !== "playing") return;
    const timer = window.setTimeout(() => {
      document.querySelector<HTMLButtonElement>(
        ".answer-area button[data-tv-focus]:not([disabled])",
      )?.focus();
    }, 45);
    return () => window.clearTimeout(timer);
  }, [challenge.id, phase, screen, settingsOpen]);

  useEffect(() => {
    const getFocusable = () => {
      const root: ParentNode = settingsOpen
        ? document.querySelector(".settings-panel") ?? document
        : document;
      const all = Array.from(root.querySelectorAll<HTMLButtonElement>("button[data-tv-focus]:not([disabled])"))
        .filter((button) => button.offsetParent !== null);
      if (settingsOpen || screen !== "game") return all;
      const answers = all.filter((button) => button.closest(".answer-area"));
      return [...answers, ...all.filter((button) => !answers.includes(button))];
    };

    const moveFocus = (direction: "left" | "right" | "up" | "down") => {
      const focusable = getFocusable();
      if (!focusable.length) return;
      const current = document.activeElement as HTMLButtonElement;
      if (!focusable.includes(current)) {
        focusable[0]?.focus();
        return;
      }

      const currentRect = current.getBoundingClientRect();
      const currentX = currentRect.left + currentRect.width / 2;
      const currentY = currentRect.top + currentRect.height / 2;
      const candidates = focusable
        .filter((button) => button !== current)
        .map((button) => {
          const rect = button.getBoundingClientRect();
          const dx = rect.left + rect.width / 2 - currentX;
          const dy = rect.top + rect.height / 2 - currentY;
          const valid = direction === "left" ? dx < -4
            : direction === "right" ? dx > 4
              : direction === "up" ? dy < -4
                : dy > 4;
          const primary = direction === "left" || direction === "right" ? Math.abs(dx) : Math.abs(dy);
          const cross = direction === "left" || direction === "right" ? Math.abs(dy) : Math.abs(dx);
          return { button, valid, score: primary + cross * 0.42 };
        })
        .filter((candidate) => candidate.valid)
        .sort((a, b) => a.score - b.score);
      (candidates[0]?.button ?? focusable[0])?.focus();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (settingsOpen) setSettingsOpen(false);
        else if (screen !== "home") goHome();
        return;
      }

      const isArrow = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key);
      if (settingsOpen && !isArrow) return;

      if (event.key.toLowerCase() === "f") {
        toggleFullscreen();
        return;
      }

      if (event.key.toLowerCase() === "r" && screen === "game") {
        repeatPrompt();
        return;
      }

      if (screen === "game" && /^[1-9]$/.test(event.key)) {
        const button = document.querySelector<HTMLButtonElement>(
          `[data-choice-index="${Number(event.key) - 1}"]`,
        );
        if (button && !button.disabled) {
          event.preventDefault();
          button.click();
        }
        return;
      }

      if (isArrow) {
        event.preventDefault();
        moveFocus(event.key.replace("Arrow", "").toLowerCase() as "left" | "right" | "up" | "down");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goHome, repeatPrompt, screen, settingsOpen, toggleFullscreen]);

  useEffect(() => {
    if (!("getGamepads" in navigator)) return;
    let previous: boolean[] = [];
    const interval = window.setInterval(() => {
      const pad = navigator.getGamepads?.().find(Boolean);
      setGamepadConnected(Boolean(pad));
      if (!pad) {
        previous = [];
        return;
      }

      const pressed = pad.buttons.map((button) => button.pressed);
      const axisX = pad.axes[0] ?? 0;
      const axisY = pad.axes[1] ?? 0;
      pressed[20] = axisY < -0.68;
      pressed[21] = axisY > 0.68;
      pressed[22] = axisX < -0.68;
      pressed[23] = axisX > 0.68;
      const emit = (index: number, key: string) => {
        if (pressed[index] && !previous[index]) {
          window.dispatchEvent(new KeyboardEvent("keydown", { key }));
        }
      };
      emit(12, "ArrowUp");
      emit(13, "ArrowDown");
      emit(14, "ArrowLeft");
      emit(15, "ArrowRight");
      emit(20, "ArrowUp");
      emit(21, "ArrowDown");
      emit(22, "ArrowLeft");
      emit(23, "ArrowRight");
      if (pressed[0] && !previous[0]) {
        (document.activeElement as HTMLElement | null)?.click?.();
      }
      emit(1, "Escape");
      previous = pressed;
    }, 90);
    return () => window.clearInterval(interval);
  }, []);

  const renderChallenge = () => {
    if (challenge.kind === "choice") {
      return (
        <div className={`choice-grid count-${challenge.choices?.length ?? 0}`} role="group" aria-label="الخيارات">
          {(challenge.choices ?? []).map((choice, index) => {
            const isCorrect = phase === "success" && choice.id === challenge.correctId;
            const isWrong = wrongChoice === choice.id;
            const isHinted = hintVisible && choice.id === challenge.correctId;
            const symbolOnly = !choice.emoji && choice.label.length <= 5 && !/[\u0600-\u06ff]/.test(choice.label);
            return (
              <motion.button
                key={choice.id}
                type="button"
                data-tv-focus
                data-choice-index={index}
                aria-label={`الخيار ${index + 1}: ${choice.label}`}
                disabled={phase === "success"}
                onClick={() => chooseAnswer(choice)}
                whileTap={{ scale: 0.96 }}
                className={`choice-button ${isWrong ? "is-wrong" : ""} ${isCorrect ? "is-correct" : ""} ${isHinted ? "is-hinted" : ""} ${symbolOnly ? "is-symbol" : ""}`}
              >
                <span className="choice-index" aria-hidden="true">{index + 1}</span>
                {choice.emoji && <span className="choice-emoji" aria-hidden="true">{choice.emoji}</span>}
                <span className="choice-label">{choice.label}</span>
                {isCorrect && <Check className="choice-check" aria-hidden="true" />}
              </motion.button>
            );
          })}
        </div>
      );
    }

    if (challenge.kind === "sequence") {
      return (
        <div className="sequence-game">
          <div className="sequence-status" aria-label={`${sequenceDone.length} خطوات صحيحة`}>
            {(challenge.sequence ?? []).map((id, index) => (
              <span key={id} className={`sequence-pip ${index < sequenceDone.length ? "is-done" : ""}`}>
                {index < sequenceDone.length ? "✓" : index + 1}
              </span>
            ))}
          </div>
          <div className={`choice-grid sequence-choices count-${challenge.choices?.length ?? 0}`} role="group" aria-label="رتّبي الخيارات">
            {(challenge.choices ?? []).map((choice, index) => {
              const isDone = sequenceDone.includes(choice.id);
              const isHinted = hintVisible && choice.id === challenge.sequence?.[sequenceDone.length];
              return (
                <motion.button
                  key={choice.id}
                  type="button"
                  data-tv-focus
                  data-choice-index={index}
                  disabled={isDone || phase === "success"}
                  onClick={() => chooseSequence(choice)}
                  whileTap={{ scale: 0.96 }}
                  className={`choice-button sequence-choice ${isDone ? "is-sequenced" : ""} ${wrongChoice === choice.id ? "is-wrong" : ""} ${isHinted ? "is-hinted" : ""}`}
                >
                  <span className="choice-index" aria-hidden="true">{index + 1}</span>
                  <span className="choice-label">{isDone ? "✓" : choice.label}</span>
                </motion.button>
              );
            })}
          </div>
        </div>
      );
    }

    if (challenge.kind === "memory") {
      return (
        <div className={`memory-grid count-${challenge.cards?.length ?? 0}`} role="group" aria-label="بطاقات الذاكرة">
          {(challenge.cards ?? []).map((card, index) => {
            const revealed = flippedCards.includes(card.id) || matchedPairs.includes(card.pairId);
            const matched = matchedPairs.includes(card.pairId);
            return (
              <motion.button
                key={card.id}
                type="button"
                data-tv-focus
                data-choice-index={index}
                disabled={matched || phase === "success"}
                aria-label={revealed ? card.label : `بطاقة مخفية ${index + 1}`}
                aria-pressed={revealed}
                onClick={() => chooseMemoryCard(card)}
                whileTap={{ scale: 0.96 }}
                className={`memory-card ${revealed ? "is-flipped" : ""} ${matched ? "is-matched" : ""}`}
              >
                <span className="memory-inner">
                  <span className="memory-back" aria-hidden="true">✦</span>
                  <span className="memory-front">
                    <span aria-hidden="true">{card.emoji ?? "💫"}</span>
                    <small>{card.label}</small>
                  </span>
                </span>
              </motion.button>
            );
          })}
        </div>
      );
    }

    return (
      <div className="family-mission">
        <div className={`family-visual ${familyRunning ? "is-running" : ""}`} aria-hidden="true">
          <span>أ</span><span>م</span><span>أ</span><span>د</span><span>ب</span>
        </div>
        {!familyRunning ? (
          <button
            type="button"
            data-tv-focus
            className="mission-button"
            onClick={() => {
              audioEngine.whoosh();
              audioEngine.speak("Everyone, let's do it together!");
              setFamilyRunning(true);
            }}
          >
            <Play fill="currentColor" /> ابدأوا المهمة
          </button>
        ) : (
          <div className="family-running">
            <div className="family-timer" aria-label={`${familyTime} ثانية متبقية`}>{familyTime}</div>
            <p>الحركة شغّالة… كلكم مع بعض!</p>
            <button type="button" data-tv-focus className="mission-button mission-done" onClick={completeChallenge}>
              <Check /> خلصنا المهمة
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`galaxy-app ${settingsOpen ? "has-modal" : ""}`} dir="rtl">
      <div className="galaxy-backdrop" aria-hidden="true" />
      <div className="star-field" aria-hidden="true" />
      <div className="aurora aurora-one" aria-hidden="true" />
      <div className="aurora aurora-two" aria-hidden="true" />

      <AnimatePresence mode="wait">
        {screen === "home" && (
          <motion.div
            key="home"
            className="galaxy-frame home-screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
          >
            <header className="topbar">
              <div className="brand-lockup">
                <div className="brand-mark" aria-hidden="true"><Sparkles /></div>
                <div>
                  <strong>مِجرة عيالنا</strong>
                  <span>كل يوم… مغامرة ما صارت قبل</span>
                </div>
              </div>
              <div className="top-actions">
                <div className="star-wallet" aria-label={`${stats.totalStars} نجمة مجموعة`}>
                  <Star fill="currentColor" />
                  <strong>{stats.totalStars.toLocaleString("ar-KW")}</strong>
                </div>
                <button type="button" data-tv-focus className="icon-button" onClick={toggleFullscreen} aria-label={isFullscreen ? "إغلاق ملء الشاشة" : "ملء الشاشة"}>
                  <Maximize2 />
                </button>
                <button type="button" data-tv-focus className="icon-button" onClick={openSettings} aria-label="الإعدادات">
                  <Settings2 />
                </button>
              </div>
            </header>

            <main className="home-layout">
              <section className="hero-panel">
                <div className="eyebrow"><Radio /> {greetingForNow()} • {weekdayLabel()}</div>
                <h1 className="hero-title">اللعبة اللي<br /><span>تعرف عيالكم</span></h1>
                <p className="hero-lede">
                  تنادي أزيان ودرة وبسمة بالاسم، تغيّر المستوى حسب العمر،
                  وتحوّل الصالة كلها إلى مسرح لعب عائلي.
                </p>
                <div className="feature-row" aria-label="مميزات اللعبة">
                  <div className="feature-chip"><span>∞</span><strong>مراحل تتولّد بلا سقف</strong></div>
                  <div className="feature-chip"><Gamepad2 /><strong>ريموت ويد ألعاب</strong></div>
                  <div className="feature-chip"><Volume2 /><strong>موسيقى ونداء بالأسماء</strong></div>
                </div>
                <div className="record-line">
                  <Trophy /> الرقم القياسي: <strong>{stats.bestScore.toLocaleString("ar-KW")}</strong>
                  <span>•</span> {stats.sessions.toLocaleString("ar-KW")} جلسة عائلية
                </div>
              </section>

              <section className="launch-panel" aria-label="ابدأ اللعب">
                <div className="launch-top">
                  <div className="mascot" aria-hidden="true">
                    <span className="mascot-tail" />
                    <span className="mascot-core"><i /><i /><b /></span>
                  </div>
                  <div className="mascot-copy">
                    <span>وَمْضة جاهزة</span>
                    <strong>منو يقود المجرة اليوم؟</strong>
                  </div>
                  <div className="live-pill"><span /> LIVE</div>
                </div>

                <div className="crew-strip" aria-label="أبطال العائلة">
                  {PLAYERS.slice(0, 3).map((player) => (
                    <div key={player.id} className="crew-card" style={{ "--crew-color": PLAYER_COLORS[player.id] } as CSSProperties}>
                      <span className="crew-avatar" aria-hidden="true">{player.emoji}</span>
                      <span className="crew-name">{player.name}</span>
                      <small>{player.age} سنوات</small>
                    </div>
                  ))}
                  <div className="crew-card parent-crew" style={{ "--crew-color": PLAYER_COLORS.family } as CSSProperties}>
                    <span className="crew-avatar" aria-hidden="true">🪄</span>
                    <span className="crew-name">أحمد + ميوم</span>
                    <small>قوة الفريق</small>
                  </div>
                </div>

                <div className="mode-grid" role="group" aria-label="اختيار نوع الجلسة">
                  {MODES.map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      data-tv-focus
                      aria-pressed={selectedMode === mode.id}
                      className={`mode-card ${selectedMode === mode.id ? "is-selected" : ""}`}
                      onClick={() => {
                        void audioEngine.start();
                        audioEngine.tap();
                        setSelectedMode(mode.id);
                      }}
                    >
                      <span className="mode-icon" aria-hidden="true">{mode.icon}</span>
                      <span className="mode-copy">
                        <small>{mode.eyebrow}</small>
                        <strong>{mode.title}</strong>
                        <span>{mode.duration}</span>
                      </span>
                      <span className="mode-radio"><Check /></span>
                    </button>
                  ))}
                </div>

                <button type="button" data-tv-focus className="launch-button" onClick={() => startSession()}>
                  <span><Play fill="currentColor" /> يلا نلعب</span>
                  <small>{modeFor(selectedMode).description}</small>
                </button>
                <button type="button" data-tv-focus className="motion-launch" onClick={() => { void audioEngine.start(); audioEngine.whoosh(); setMotionOpen(true); }}>
                  <span>📸 العبوا بالحركة!</span>
                  <small>لوّحوا بأيديكم قدام الكاميرا لمسك النجوم</small>
                </button>
                <div className="micro-help"><Keyboard /> الأرقام ١–٩ للاختيار • الأسهم للريموت • R يعيد السؤال</div>
              </section>
            </main>
          </motion.div>
        )}

        {screen === "countdown" && (
          <motion.main key="countdown" className="galaxy-frame countdown-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.08 }}>
            <div className="countdown-card">
              <div className="eyebrow"><Zap /> شغّلنا طاقة العائلة</div>
              <div className="countdown-crew" aria-hidden="true">
                {PLAYERS.slice(0, 3).map((player) => <span key={player.id}>{player.emoji}</span>)}
              </div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={countdown}
                  className="countdown-number"
                  initial={{ scale: 0.35, opacity: 0, rotate: -12 }}
                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                  exit={{ scale: 1.45, opacity: 0 }}
                >
                  {countdown === 0 ? "انطلقوا!" : countdown}
                </motion.div>
              </AnimatePresence>
              <p>{modeFor(activeMode).title} • كل الإجابات تبني قوة الفريق</p>
            </div>
          </motion.main>
        )}

        {screen === "game" && (
          <motion.div key={`game-${challenge.id}`} className="galaxy-frame game-screen" style={worldStyle} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <header className="game-hud">
              <button type="button" data-tv-focus className="icon-button hud-home" onClick={goHome} aria-label="العودة للرئيسية"><Home /></button>
              <div className="hud-brand"><Sparkles /><strong>مِجرة عيالنا</strong></div>
              <div className="world-pill"><span>{challenge.world.emoji}</span><div><small>{challenge.world.name}</small><strong>{challenge.world.landmark}</strong></div></div>
              <div className="hud-score"><small>الطاقة</small><strong><Star fill="currentColor" /> {score}</strong></div>
              <div className="hud-streak"><small>السلسلة</small><strong><Zap fill="currentColor" /> ×{streak}</strong></div>
              <button type="button" data-tv-focus className="icon-button" onClick={repeatPrompt} aria-label="إعادة سماع السؤال"><Volume2 /></button>
              <button type="button" data-tv-focus className="icon-button" onClick={openSettings} aria-label="الإعدادات"><Settings2 /></button>
            </header>

            <div className="progress-track" aria-label={`الجولة ${round}`}>
              <motion.span className="progress-fill" animate={{ width: `${progress}%` }} />
            </div>

            <Lulu mood={luluMood} name={activePlayer.name} className="arena-lulu" />

            <main className="stage-layout">
              <aside className="player-orbit">
                <div className="active-player-halo">
                  <div className="active-avatar" aria-hidden="true">{activePlayer.emoji}</div>
                </div>
                <div className="active-player-copy">
                  <span>الدور الآن</span>
                  <h2>{activePlayer.name}</h2>
                  <p>{activePlayer.title}</p>
                </div>
                <div className="round-counter">
                  <small>الجولة</small>
                  <strong>{round.toLocaleString("ar-KW")}</strong>
                  <span>/ {activeModeConfig.rounds?.toLocaleString("ar-KW") ?? "∞"}</span>
                </div>
                <div className="treasure-card"><span>كنز العالم</span><strong>{challenge.world.collectible}</strong></div>
              </aside>

              <section className={`challenge-card kind-${challenge.kind}`}>
                <div className="challenge-glow" aria-hidden="true" />
                <div className="challenge-head">
                  <div>
                    <span className="challenge-kicker">{challenge.kicker}</span>
                    <h1 className="challenge-title">{challenge.title}</h1>
                    <p className="challenge-instruction">{challenge.instruction}</p>
                    {challenge.kind !== "family" && (
                      <div className="assist-bar">
                        <button type="button" data-tv-focus className="hint-button" onClick={showHint}>
                          💡 {hintVisible ? "أعيدوا التلميح" : "نبي تلميح"}
                        </button>
                        {attempts >= 2 && (
                          <button type="button" data-tv-focus className="skip-button" onClick={completeChallenge}>
                            🤝 نكمّلها كفريق
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <button type="button" data-tv-focus className="speak-button" onClick={repeatPrompt} aria-label="اسمع التعليمات"><Volume2 /><span>اسمعها</span></button>
                </div>
                <div className="answer-area">{renderChallenge()}</div>
                <div className="round-status" role="status" aria-live="polite">{statusMessage}</div>

                <AnimatePresence>
                  {phase === "success" && (
                    <motion.div className="feedback-burst" role="status" initial={{ opacity: 0, scale: 0.72 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                      <div className="feedback-rays" aria-hidden="true" />
                      <div className="feedback-orb">+{comboReward}<Star fill="currentColor" /></div>
                      <h2>{challenge.celebration}</h2>
                      <p>{streak > 1 ? `سلسلة رهيبة ×${streak}` : "بداية قوية!"}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>
            </main>

            <footer className="game-footer">
              <span><Keyboard /> ١–٩ اختيار</span>
              <span><Gamepad2 /> {gamepadConnected ? "يد الألعاب متصلة" : "يد الألعاب جاهزة للاتصال"}</span>
              <span><Volume2 /> R يعيد السؤال</span>
              <button type="button" data-tv-focus onClick={toggleFullscreen}><Maximize2 /> {isFullscreen ? "إغلاق الملء" : "ملء الشاشة"}</button>
            </footer>
          </motion.div>
        )}

        {screen === "summary" && (
          <motion.main key="summary" className="galaxy-frame summary-screen" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
            <div className="confetti-layer" aria-hidden="true">
              {Array.from({ length: 24 }, (_, index) => (
                <i key={index} style={{
                  "--x": `${(index * 43) % 100}%`,
                  "--delay": `${(index % 8) * -0.18}s`,
                  "--spin": `${160 + (index % 5) * 75}deg`,
                } as CSSProperties} />
              ))}
            </div>
            <section className="summary-panel">
              <div className="summary-trophy" aria-hidden="true"><Trophy /></div>
              <div className="eyebrow"><Sparkles /> الرحلة اكتملت</div>
              <h1>أقوى طاقم في المجرة!</h1>
              <p>أزيان ودرة وبسمة… وأحمد وميوم: كل واحد فيكم شغّل جزءاً من المركبة.</p>
              <div className="summary-score"><Star fill="currentColor" /><strong>{score.toLocaleString("ar-KW")}</strong><span>طاقة المجموعة</span></div>
              <div className="summary-stats">
                <div><span>🔥</span><strong>×{sessionBestStreak}</strong><small>أفضل سلسلة</small></div>
                <div><span>🪐</span><strong>{activeModeConfig.rounds ?? round}</strong><small>جولة مكتملة</small></div>
                <div><span>🏆</span><strong>{stats.bestScore}</strong><small>الرقم القياسي</small></div>
              </div>
              <div className="summary-actions">
                <button type="button" data-tv-focus className="secondary-action" onClick={goHome}><Home /> الرئيسية</button>
                <button type="button" data-tv-focus className="secondary-action" onClick={() => startSession(activeMode)}><RotateCcw /> جولة ثانية</button>
                <button type="button" data-tv-focus className="primary-action" onClick={() => startSession("endless")}><span>∞</span> كملوا بلا نهاية</button>
              </div>
            </section>
          </motion.main>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {settingsOpen && (
          <motion.div className="modal-layer" role="presentation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSettingsOpen(false);
          }}>
            <motion.section ref={settingsPanelRef} className="settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title" initial={{ y: 28, scale: 0.96 }} animate={{ y: 0, scale: 1 }} exit={{ y: 28, scale: 0.96 }}>
              <div className="settings-head">
                <div><span>غرفة التحكم</span><h2 id="settings-title">الصوت والشاشة</h2></div>
                <button type="button" data-tv-focus className="icon-button" onClick={() => setSettingsOpen(false)} aria-label="إغلاق"><X /></button>
              </div>

              <div className="setting-list">
                <div className="setting-row">
                  <div className="setting-icon"><Music2 /></div>
                  <div><strong>موسيقى المجرة</strong><span>لحن أصلي يتغيّر بين اللعب والاحتفال</span></div>
                  <button type="button" data-tv-focus role="switch" aria-label="تشغيل موسيقى المجرة" aria-checked={settings.music} className={`switch ${settings.music ? "is-on" : ""}`} onClick={() => setSettings((current) => ({ ...current, music: !current.music }))}><i /></button>
                </div>
                <div className="setting-row">
                  <div className="setting-icon">{settings.sound ? <Volume2 /> : <VolumeX />}</div>
                  <div><strong>المؤثرات</strong><span>نقرات، انطلاقات ومكافآت واضحة</span></div>
                  <button type="button" data-tv-focus role="switch" aria-label="تشغيل المؤثرات الصوتية" aria-checked={settings.sound} className={`switch ${settings.sound ? "is-on" : ""}`} onClick={() => setSettings((current) => ({ ...current, sound: !current.sound }))}><i /></button>
                </div>
                <div className="setting-row">
                  <div className="setting-icon">{settings.speech ? <Mic2 /> : <MicOff />}</div>
                  <div><strong>المنادي العربي</strong><span>يقول الأسماء ويقرأ التعليمات</span></div>
                  <button type="button" data-tv-focus role="switch" aria-label="تشغيل المنادي العربي" aria-checked={settings.speech} className={`switch ${settings.speech ? "is-on" : ""}`} onClick={() => setSettings((current) => ({ ...current, speech: !current.speech }))}><i /></button>
                </div>
              </div>

              <div className="settings-actions">
                <button type="button" data-tv-focus onClick={() => {
                  void audioEngine.start();
                  audioEngine.speak("Get ready, Azian, Durrah, and Basma! Let's go!");
                }}><Mic2 /> جرّبوا نداء الأسماء</button>
                <button type="button" data-tv-focus onClick={toggleFullscreen}><Maximize2 /> {isFullscreen ? "إغلاق ملء الشاشة" : "ملء الشاشة للتلفزيون"}</button>
              </div>
              <p className="settings-note">الصوت يعمل من المتصفح ولا يرسل أي تسجيلات أو بيانات خارج الجهاز.</p>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

      {motionOpen && <MotionGame onClose={() => setMotionOpen(false)} />}
    </div>
  );
}

export default App;

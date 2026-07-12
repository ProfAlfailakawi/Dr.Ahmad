import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { audioEngine } from "../galaxyAudio";

/**
 * لعبة الحركة بالكاميرا 📸 — يلوّحون بأيديهم قدام الكاميرا لمسك النجوم والفقاعات.
 * تكتشف الكاميرا تلقائياً؛ إن لم تتوفر (تلفزيون بلا كاميرا / رُفض الإذن) ترجع للمس.
 * كشف الحركة عبر فرق الإطارات (بدون مكتبات) — خفيف وسريع.
 */

type Phase = "asking" | "camera" | "touch";

interface Target {
  id: number;
  x: number; // 0..1 (نسبة العرض)
  y: number; // 0..1
  vx: number;
  vy: number;
  r: number; // نصف القطر بالبكسل
  emoji: string;
  dead: boolean;
  born: number;
}

const EMOJIS = ["⭐", "🫧", "🎈", "💫", "🌟", "🪄", "🍬", "🦋"];
const CHEERS = ["Wow!", "Amazing!", "Bravo!", "Yes! Superstar!", "Woohoo!", "Fantastic!"];
const GOAL = 20;

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]!;

export function MotionGame({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>("asking");
  const [score, setScore] = useState(0);
  const [won, setWon] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const targetsRef = useRef<Target[]>([]);
  const nextIdRef = useRef(1);
  const scoreRef = useRef(0);
  const lastSpawnRef = useRef(0);
  const wonRef = useRef(false);

  // معالجة الحركة: لوحة مصغّرة + إطار سابق
  const motionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevGrayRef = useRef<Uint8ClampedArray | null>(null);
  const MW = 96, MH = 72; // دقة كشف الحركة

  const pop = useCallback((t: Target, clientX: number, clientY: number) => {
    if (t.dead || wonRef.current) return;
    t.dead = true;
    void clientX; void clientY;
    scoreRef.current += 1;
    setScore(scoreRef.current);
    if (Math.random() < 0.35) audioEngine.speak(pick(CHEERS));
    else audioEngine.success();
    if (scoreRef.current >= GOAL && !wonRef.current) {
      wonRef.current = true;
      setWon(true);
      audioEngine.speak("Woohoo! You did it! You're a superstar!");
    }
  }, []);

  // إعداد الكاميرا
  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("no-camera");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setPhase("camera");
      } catch {
        if (!cancelled) setPhase("touch");
      }
    };
    void start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // حلقة اللعبة
  useEffect(() => {
    if (phase === "asking") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const motionCanvas = motionCanvasRef.current ?? document.createElement("canvas");
    motionCanvas.width = MW; motionCanvas.height = MH;
    motionCanvasRef.current = motionCanvas;
    const mctx = motionCanvas.getContext("2d", { willReadFrequently: true })!;

    const fit = () => { canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight; };
    fit();
    window.addEventListener("resize", fit);

    let last = performance.now();

    const computeMotion = (): Float32Array | null => {
      const video = videoRef.current;
      if (phase !== "camera" || !video || video.readyState < 2) return null;
      // نرسم الفيديو مقلوباً أفقياً (مثل المرآة) بنفس ما يُعرض
      mctx.save();
      mctx.scale(-1, 1);
      mctx.drawImage(video, -MW, 0, MW, MH);
      mctx.restore();
      const frame = mctx.getImageData(0, 0, MW, MH).data;
      const gray = new Uint8ClampedArray(MW * MH);
      for (let i = 0, j = 0; i < frame.length; i += 4, j++) {
        gray[j] = (frame[i]! * 0.3 + frame[i + 1]! * 0.59 + frame[i + 2]! * 0.11);
      }
      const prev = prevGrayRef.current;
      const motion = new Float32Array(MW * MH);
      if (prev) {
        for (let j = 0; j < gray.length; j++) {
          const d = Math.abs(gray[j]! - prev[j]!);
          motion[j] = d > 26 ? 1 : 0;
        }
      }
      prevGrayRef.current = gray;
      return motion;
    };

    const motionAt = (motion: Float32Array | null, nx: number, ny: number): number => {
      if (!motion) return 0;
      const gx = Math.floor(nx * MW), gy = Math.floor(ny * MH);
      let sum = 0, n = 0;
      const rad = 4;
      for (let dy = -rad; dy <= rad; dy++) {
        for (let dx = -rad; dx <= rad; dx++) {
          const x = gx + dx, y = gy + dy;
          if (x < 0 || y < 0 || x >= MW || y >= MH) continue;
          sum += motion[y * MW + x]!; n++;
        }
      }
      return n ? sum / n : 0;
    };

    const spawn = (now: number) => {
      const interval = 620;
      if (now - lastSpawnRef.current < interval) return;
      lastSpawnRef.current = now;
      if (targetsRef.current.filter((t) => !t.dead).length > 7) return;
      const fromLeft = Math.random() < 0.5;
      targetsRef.current.push({
        id: nextIdRef.current++,
        x: fromLeft ? -0.05 : 1.05,
        y: rnd(0.15, 0.8),
        vx: fromLeft ? rnd(0.03, 0.08) : -rnd(0.03, 0.08),
        vy: rnd(-0.02, 0.02),
        r: rnd(34, 60),
        emoji: pick(EMOJIS),
        dead: false,
        born: now,
      });
    };

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      const motion = computeMotion();
      if (!wonRef.current) spawn(now);

      const alive: Target[] = [];
      for (const t of targetsRef.current) {
        if (t.dead) continue;
        t.x += t.vx * dt; t.y += t.vy * dt;
        if (t.x < -0.15 || t.x > 1.15) continue; // خرج
        // كشف حركة فوق الهدف
        const m = motionAt(motion, t.x, t.y);
        if (m > 0.18) {
          pop(t, t.x * W, t.y * H);
          continue;
        }
        alive.push(t);
        // رسم الهدف
        const px = t.x * W, py = t.y * H;
        ctx.save();
        ctx.globalAlpha = 0.95;
        ctx.font = `${t.r * 2}px serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.shadowColor = "rgba(120,180,255,0.9)"; ctx.shadowBlur = 22;
        ctx.fillText(t.emoji, px, py);
        ctx.restore();
      }
      targetsRef.current = alive;

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", fit);
    };
  }, [phase, pop]);

  // نقر/لمس للفقاعات (يعمل مع أو بدون كاميرا)
  const onPointer = (e: ReactPointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    let best: Target | null = null; let bestD = Infinity;
    for (const t of targetsRef.current) {
      if (t.dead) continue;
      const dx = (t.x - nx) * rect.width, dy = (t.y - ny) * rect.height;
      const d = Math.hypot(dx, dy);
      if (d < t.r + 24 && d < bestD) { bestD = d; best = t; }
    }
    if (best) pop(best, e.clientX, e.clientY);
  };

  const restart = () => {
    targetsRef.current = [];
    scoreRef.current = 0; setScore(0);
    wonRef.current = false; setWon(false);
  };

  return (
    <div className="motion-game" dir="rtl">
      <video ref={videoRef} className="motion-video" playsInline muted />
      <div className="motion-dim" />
      <canvas ref={canvasRef} className="motion-canvas" onPointerDown={onPointer} />

      <header className="motion-hud">
        <button type="button" className="motion-btn" onClick={onClose}>🏠 رجوع</button>
        <div className="motion-title">
          {phase === "camera" ? "📸 لوّحوا بأيديكم!" : "👆 المسوا النجوم!"}
        </div>
        <div className="motion-score">⭐ {score} / {GOAL}</div>
      </header>

      {phase === "asking" && (
        <div className="motion-overlay">
          <div className="motion-card">
            <div className="motion-emoji">📸</div>
            <h2>نفتح الكاميرا…</h2>
            <p>لو ظهر طلب إذن الكاميرا، اضغطوا "سماح" — عشان تلعبون بحركة أيديكم!</p>
          </div>
        </div>
      )}

      {won && (
        <div className="motion-overlay">
          <div className="motion-card win">
            <div className="motion-emoji">🏆</div>
            <h2>Woohoo! Bravo!</h2>
            <p>مسكتوا {GOAL} نجمة! 🎉</p>
            <div className="motion-actions">
              <button type="button" className="motion-btn big" onClick={restart}>مرة ثانية 🔁</button>
              <button type="button" className="motion-btn big" onClick={onClose}>🏠 القائمة</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

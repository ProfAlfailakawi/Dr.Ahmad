// خادم إنتاج: يقدّم مخرجات البناء (dist) + وكيل صوت البنت (Google Cloud TTS).
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import textToSpeech from "@google-cloud/text-to-speech";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "dist");
const app = express();

/* ─────────── صوت البنت: Google Cloud Text-to-Speech ───────────
   صوت أنثوي عربي فخم (WaveNet). المصادقة تلقائية عبر حساب Cloud Run.
   نخزّن كل جملة مؤقتاً حتى لا نعيد توليدها. */
// صوت إنجليزي أنثوي حماسي ومعبّر (Studio) — ينادي الأسماء بحماس.
const VOICE = { languageCode: "en-US", name: "en-US-Studio-O" };
const AUDIO = { audioEncoding: "MP3", speakingRate: 1.06 };
const ttsCache = new Map(); // نص -> Buffer(mp3)
const MAX_CACHE = 500;
const ttsClient = new textToSpeech.TextToSpeechClient();

app.get("/api/say", async (req, res) => {
  const text = String(req.query.t || "").slice(0, 240).trim();
  if (!text) return res.status(400).json({ error: "empty" });
  try {
    let mp3 = ttsCache.get(text);
    if (!mp3) {
      const [response] = await ttsClient.synthesizeSpeech({
        input: { text },
        voice: VOICE,
        audioConfig: AUDIO,
      });
      mp3 = Buffer.from(response.audioContent);
      if (ttsCache.size >= MAX_CACHE) ttsCache.delete(ttsCache.keys().next().value);
      ttsCache.set(text, mp3);
    }
    res.set("Content-Type", "audio/mpeg");
    res.set("Cache-Control", "public, max-age=604800");
    res.send(mp3);
  } catch (e) {
    res.status(502).json({ error: String((e && e.message) || e) });
  }
});

app.use(express.static(distDir, { maxAge: "1h", index: false }));
app.get("*", (_req, res) => res.sendFile(path.join(distDir, "index.html")));

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`مِجرة عيالنا — يعمل على المنفذ ${port}`));

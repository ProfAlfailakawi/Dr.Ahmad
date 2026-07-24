#!/usr/bin/env python3
"""تعرّفٌ مجانيٌّ على الكلام عبر faster-whisper (محلّي، بلا حساب ولا حصّة).
يحفظ شرط الدكتور: التحقّق من نطق الصوت المُولَّد — لكن بلا كلفة Azure STT.
الاستعمال: python3 whisper-stt.py <wav> <lang: ar|en> [model=small]
يطبع النص المُتعرَّف عليه على stdout، والأخطاء على stderr."""
import sys

def main() -> int:
    if len(sys.argv) < 3:
        print("usage: whisper-stt.py <wav> <lang> [model]", file=sys.stderr)
        return 2
    wav, lang = sys.argv[1], sys.argv[2]
    model_name = sys.argv[3] if len(sys.argv) > 3 else "small"
    try:
        from faster_whisper import WhisperModel
    except Exception as exc:  # noqa: BLE001
        print(f"faster-whisper غير مثبّت: {exc}", file=sys.stderr)
        return 3
    try:
        model = WhisperModel(model_name, device="cpu", compute_type="int8")
        # vad_filter=True كان يقتطع الكلمات القصيرة على الأطراف («لا» النافية) فتسقط
        # مداخلةٌ سليمة النطق (u002). نطفئه: المقاطع قصيرة ونظيفة أصلاً (توليد TTS)،
        # فلا صمت طويل يستدعي الترشيح. beam_size=5 يرفع دقة العربية،
        # وtemperature=0 يجعل النتيجة حتمية قابلة للتكرار.
        segments, _info = model.transcribe(
            wav, language=lang, beam_size=5, vad_filter=False,
            temperature=0.0, condition_on_previous_text=False,
        )
        text = " ".join(seg.text.strip() for seg in segments).strip()
        # نطبع النص فقط (بلا أسطر إضافية) ليقرأه المحرّك مباشرةً
        sys.stdout.write(text)
        return 0
    except Exception as exc:  # noqa: BLE001
        print(f"whisper transcribe فشل: {exc}", file=sys.stderr)
        return 4

if __name__ == "__main__":
    raise SystemExit(main())

import fs from 'node:fs'
import path from 'node:path'
import { projectRoot, flags } from './config.mjs'

const forbidden = ['stripe', 'twilio', 'whatsapp cloud api', 'meta cloud api', 'anthropic', 'openai api', 'pinecone', 'supabase']

export function runCostAudit(root = projectRoot) {
  const packageFile = path.join(root, 'whatsapp-agent', 'package.json')
  const packageJson = JSON.parse(fs.readFileSync(packageFile, 'utf8'))
  const text = JSON.stringify(packageJson).toLowerCase()
  const findings = []
  for (const name of forbidden) if (text.includes(name)) findings.push({ status: 'blocked', service: name, note: 'غير مسموح به في الوكيل.' })
  const azureConfigured = Boolean(process.env.AZURE_SPEECH_KEY || process.env.AZURE_SPEECH_REGION)
  findings.push({ status: flags.zeroCost && !flags.voice ? 'disabled' : azureConfigured ? 'needs-confirmation' : 'disabled', service: 'Azure Speech', note: flags.voice ? 'الصوت مفعّل، ويجب تأكيد F0 قبل أي طلب.' : 'معطّل افتراضياً.' })
  findings.push({ status: 'local', service: 'SQLite / Baileys', note: 'تخزين وتشغيل محليان؛ لا توجد خدمة رسائل مدفوعة.' })
  findings.push({ status: 'existing-site-only', service: 'Firebase/Gemini', note: 'الكود الموجود للموقع خارج الوكيل؛ الوكيل لا يستدعي Gemini ولا يرفع بيانات واتساب.' })
  const blocked = findings.some((item) => item.status === 'blocked')
  return { ok: !blocked && flags.zeroCost, zeroCostMode: flags.zeroCost, findings }
}

if (import.meta.url === `file://${process.argv[1]}`) console.log(JSON.stringify(runCostAudit(), null, 2))

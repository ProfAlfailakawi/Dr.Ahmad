#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DB_PATH, DATA_DIR, flags, projectRoot, redactError } from './config.mjs'
import { openDatabase } from './db.mjs'
import { createAgent, ensureLock, removeLock } from './agent.mjs'
import { runSelfTest } from './self-test.mjs'
import { runCostAudit } from './cost-audit.mjs'
import { install, uninstall } from './install-macos.mjs'

const lockPath = path.join(DATA_DIR, 'agent.lock')
const command = process.argv[2] || 'status'
const db = openDatabase()
const agent = createAgent({ db, root: projectRoot })

function rotateLocalLogs({ maxBytes = 2 * 1024 * 1024, keep = 5 } = {}) {
  for (const name of ['agent.out.log', 'agent.err.log']) {
    const file = path.join(DATA_DIR, name)
    try {
      if (!fs.existsSync(file) || fs.statSync(file).size <= maxBytes) continue
      for (let index = keep - 1; index >= 1; index -= 1) {
        const from = `${file}.${index}`
        const to = `${file}.${index + 1}`
        if (fs.existsSync(from)) fs.renameSync(from, to)
      }
      fs.renameSync(file, `${file}.1`)
      fs.writeFileSync(file, '', { mode: 0o600 })
    } catch { /* log rotation must never block the agent */ }
  }
}

async function main() {
  if (command === 'self-test') { console.log(JSON.stringify(await runSelfTest(projectRoot), null, 2)); return }
  if (command === 'cost-audit') { console.log(JSON.stringify(runCostAudit(projectRoot), null, 2)); return }
  if (command === 'index') { console.log(JSON.stringify(agent.index(), null, 2)); return }
  if (command === 'status') { console.log(JSON.stringify(agent.status(), null, 2)); return }
  if (command === 'bridge-secret') { console.log(agent.bridgeSecret()); return }
  if (command === 'install') { console.log(`تم تثبيت LaunchAgent: ${install()}`); return }
  if (command === 'uninstall') { await agent.stop(); console.log(`تمت الإزالة: ${uninstall()}`); return }
  if (command === 'start') {
    rotateLocalLogs()
    if (!ensureLock(lockPath)) throw new Error('الوكيل يعمل مسبقًا أو يوجد ملف قفل قديم.')
    const phoneNumber = process.argv.find((arg) => arg.startsWith('--phone='))?.slice('--phone='.length)
    process.on('SIGINT', async () => { await agent.stop(); removeLock(lockPath); process.exit(0) })
    process.on('SIGTERM', async () => { await agent.stop(); removeLock(lockPath); process.exit(0) })
    const state = await agent.start({ phoneNumber }); console.log(JSON.stringify(state, null, 2)); return
  }
  if (command === 'stop') { await agent.stop(); removeLock(lockPath); console.log('تم إيقاف الوكيل.'); return }
  if (command === 'send-self') {
    if (!process.argv.includes('--confirm')) throw new Error('أضف --confirm لإرسال تجربة إلى نفسك فقط.')
    const textIndex = process.argv.indexOf('--text'); const text = textIndex >= 0 ? process.argv[textIndex + 1] : ''
    await agent.sendSelf(text); console.log('تم إرسال تجربة إلى الذات.')
    return
  }
  if (command === 'send-campaign') {
    if (!process.argv.includes('--confirm') || !process.argv.includes('--confirm-again')) throw new Error('إرسال الحملة يحتاج --confirm و --confirm-again.')
    const id = process.argv.find((arg) => arg.startsWith('--id='))?.slice('--id='.length)
    if (!id) throw new Error('أضف --id=CAMPAIGN_ID')
    console.log(JSON.stringify(await agent.sendCampaign(id, { confirm: true, confirmAgain: true }), null, 2))
    return
  }
  if (command === 'stop-campaign') {
    const id = process.argv.find((arg) => arg.startsWith('--id='))?.slice('--id='.length)
    if (!id) throw new Error('أضف --id=CAMPAIGN_ID')
    agent.stopCampaign(id); console.log('تم إيقاف الحملة.'); return
  }
  if (command === 'logout') {
    if (!process.argv.includes('--confirm') || !process.argv.includes('--confirm-again')) throw new Error('حذف الجلسة يحتاج --confirm و --confirm-again.')
    await agent.state.transport?.logout?.(); db.deleteAuth(); db.setState({ status: 'disconnected', qr: null, pairing_code: null }); console.log('حُذفت جلسة واتساب المحلية فقط.')
    return
  }
  throw new Error(`أمر غير معروف: ${command}`)
}

main().catch((error) => {
  if (command === 'start') removeLock(lockPath)
  console.error(`خطأ: ${redactError(error)}`)
  process.exitCode = 1
}).finally(() => { if (command !== 'start') db.close() })

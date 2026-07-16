import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { DATA_DIR, LAUNCH_AGENT_LABEL } from './config.mjs'

const home = os.homedir()
const launchDir = path.join(home, 'Library', 'LaunchAgents')
const plistPath = path.join(launchDir, `${LAUNCH_AGENT_LABEL}.plist`)
const entry = fileURLToPath(new URL('./cli.mjs', import.meta.url))

export function install() {
  if (process.platform !== 'darwin') throw new Error('التثبيت التلقائي متاح على macOS فقط.')
  fs.mkdirSync(launchDir, { recursive: true, mode: 0o700 })
  fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 })
  const plist = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>Label</key><string>${LAUNCH_AGENT_LABEL}</string><key>ProgramArguments</key><array><string>${process.execPath}</string><string>${entry}</string><string>start</string></array><key>RunAtLoad</key><true/><key>KeepAlive</key><false/><key>WorkingDirectory</key><string>${path.dirname(path.dirname(entry))}</string><key>StandardOutPath</key><string>${path.join(DATA_DIR, 'agent.out.log')}</string><key>StandardErrorPath</key><string>${path.join(DATA_DIR, 'agent.err.log')}</string></dict></plist>`
  fs.writeFileSync(plistPath, plist, { mode: 0o600 })
  try { execFileSync('launchctl', ['load', plistPath], { stdio: 'ignore' }) } catch { /* loaded on next login */ }
  return plistPath
}

export function uninstall() {
  if (process.platform === 'darwin') { try { execFileSync('launchctl', ['unload', plistPath], { stdio: 'ignore' }) } catch { /* noop */ } }
  try { fs.unlinkSync(plistPath) } catch { /* noop */ }
  return plistPath
}

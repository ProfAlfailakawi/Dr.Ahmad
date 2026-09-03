import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cert, deleteApp, initializeApp } from 'firebase-admin/app'
import { getSecurityRules } from 'firebase-admin/security-rules'

const projectId = String(process.env.FIREBASE_PROJECT_ID || 'drahmad-8e9e2').trim()
const serviceAccountPath = resolve(process.env.FIREBASE_SERVICE_ACCOUNT || 'sa.json')
const rulesPath = resolve(process.env.FIRESTORE_RULES_FILE || 'firestore.rules')

function fail(message) {
  console.error(`::error title=Firestore rules deploy::${message}`)
  process.exitCode = 1
}

if (!existsSync(serviceAccountPath)) {
  fail(`Service account file not found: ${serviceAccountPath}`)
} else if (!existsSync(rulesPath)) {
  fail(`Firestore rules file not found: ${rulesPath}`)
} else {
  let account
  try {
    account = JSON.parse(readFileSync(serviceAccountPath, 'utf8'))
  } catch (error) {
    fail(`Invalid service account JSON: ${error.message}`)
  }

  if (!process.exitCode) {
    if (account.project_id && account.project_id !== projectId) {
      fail(`Refusing to deploy: credential project ${account.project_id} does not match ${projectId}`)
    } else {
      const app = initializeApp({ credential: cert(account), projectId }, `firestore-rules-${Date.now()}`)
      try {
        const source = readFileSync(rulesPath, 'utf8')
        const ruleset = await getSecurityRules(app).releaseFirestoreRulesetFromSource(source)
        console.log(`✓ Firestore rules deployed directly to ${projectId} (${ruleset.name}).`)
      } catch (error) {
        fail(error?.message || String(error))
      } finally {
        await deleteApp(app)
      }
    }
  }
}

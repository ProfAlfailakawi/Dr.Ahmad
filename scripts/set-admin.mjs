import admin from 'firebase-admin'
import fs from 'fs'
import path from 'path'
import readline from 'readline'

const CONFIG_PATH = './firebase-applet-config.json'
const SERVICE_ACCOUNT_PATH = './service-account.json'

// Read the Firebase project ID from configuration
let projectId = ''
try {
  if (fs.existsSync(CONFIG_PATH)) {
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'))
    projectId = config.projectId
  }
} catch (e) {
  // Silent fallback
}

console.log('\n\x1b[36m%s\x1b[0m', '═══ تهيئة صلاحية المشرف (Admin Claims Utility) ═══')

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.log('\n\x1b[31m%s\x1b[0m', '⚠️ خطأ: ملف service-account.json غير موجود!')
  console.log('\n\x1b[33m%s\x1b[0m', 'للبدء والتمكن من تعيين حسابك كمشرف، يرجى اتباع الخطوات التالية:')
  console.log('1. اذهب إلى Firebase Console (https://console.firebase.google.com)')
  console.log('2. اختر مشروعك:', projectId || 'مشروعك الحالي')
  console.log('3. اضغط على أيقونة الإعدادات (⚙️) بجوار Project Overview ثم اختر Project settings')
  console.log('4. اذهب إلى تبويب Service accounts')
  console.log('5. اضغط على زر Generate new private key')
  console.log('6. قم بتنزيل الملف وتسميته باسم service-account.json وضعه في المجلد الرئيسي للمشروع.')
  process.exit(1)
}

const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'))

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
})

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

rl.question('\n✉️ أدخل البريد الإلكتروني للحساب المراد جعله مشرفاً: ', async (email) => {
  const cleanEmail = email.trim()
  if (!cleanEmail) {
    console.log('❌ بريد إلكتروني غير صالح.')
    rl.close()
    process.exit(1)
  }

  try {
    const user = await admin.auth().getUserByEmail(cleanEmail)
    await admin.auth().setCustomUserClaims(user.uid, { admin: true })
    console.log('\n\x1b[32m%s\x1b[0m', `✨ نجاح: تم منح صلاحيات المشرف (admin: true) للحساب ${cleanEmail} بنجاح!`)
    console.log('يمكنك الآن تسجيل الدخول من لوحة التحكم لتعديل وإضافة المحتوى.')
  } catch (error) {
    console.error('\n❌ حدث خطأ أثناء تعيين الصلاحيات:', error.message)
  } finally {
    rl.close()
  }
})

import { isNativePushAvailable, readNativePushPermission } from '../native-push.ts'

/** حالة إذن الإشعارات للوحة التحكم: إذن المتصفح على الويب، وإذن النظام (APNs) داخل التطبيق. */
export type AdminPushPermission = NotificationPermission | 'unsupported'

/** قيمة أولية متزامنة. داخل التطبيق يُقرأ الإذن الحقيقي بعدها عبر readAdminPushPermission. */
export function initialAdminPushPermission(): AdminPushPermission {
  if (isNativePushAvailable()) return 'default'
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
}

export async function readAdminPushPermission(): Promise<AdminPushPermission> {
  if (isNativePushAvailable()) return readNativePushPermission()
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
}

/*
 * شبكةُ أمانٍ لشجرة العناصر.
 *
 * حين يُعدّل طرفٌ خارجي الصفحة — ترجمةُ المتصفح التلقائية، إضافةٌ في المتصفح،
 * أو نصٌّ برمجي يكتب innerHTML فوق عنصرٍ يملكه React — تختفي عقدةٌ يظنّ React
 * أنها ما زالت في مكانها. فإذا حاول إزالتها رمى المتصفح:
 *   Failed to execute 'removeChild' on 'Node': The node to be removed is not a
 *   child of this node.
 * وهو خطأٌ في العرض يُسقط الصفحة كلها إلى حارس العطب.
 *
 * العلاج الجذري لكل حالةٍ من كودنا هو ألّا نتنازع على العقدة أصلاً. لكن ما يفعله
 * المتصفح أو إضافاته خارج أيدينا، فنجعل هاتين العمليتين متسامحتين: إن لم تكن
 * العقدة ابناً لهذا الأب فقد أُزيلت فعلاً — وهو ما أراده المتصفح — فنمضي بلا
 * رمي، ونسجّل في الكونسول للتشخيص. ما عدا هذه الحالة يبقى السلوك كما هو.
 */

let installed = false

export function installDomResilience() {
  if (installed || typeof Node === 'undefined') return
  installed = true

  const nativeRemoveChild = Node.prototype.removeChild
  const nativeInsertBefore = Node.prototype.insertBefore

  Node.prototype.removeChild = function removeChildSafely<T extends Node>(this: Node, child: T): T {
    if (child?.parentNode !== this) {
      console.warn('[شبكة الأمان] عقدةٌ أُزيلت من خارج React قبل إزالتها منه:', child)
      return child
    }
    return nativeRemoveChild.call(this, child) as T
  }

  Node.prototype.insertBefore = function insertBeforeSafely<T extends Node>(this: Node, node: T, reference: Node | null): T {
    if (reference && reference.parentNode !== this) {
      console.warn('[شبكة الأمان] مرجعُ الإدراج لم يعد في مكانه، فأُلحقت العقدة بالنهاية:', reference)
      return nativeInsertBefore.call(this, node, null) as T
    }
    return nativeInsertBefore.call(this, node, reference) as T
  }
}

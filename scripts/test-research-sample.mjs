import assert from 'node:assert/strict'
import { cleanResearchSample, inferResearchSample, isPlausibleResearchSample, splitResearchSentences } from '../src/lib/research-sample.mjs'

const cloudComputingAbstract = 'هدفت الدراسة إلى الكشف عن واقع استخدام الحوسبة السحابية في التعليم الجامعي. استُخدم المنهج الوصفي المسحي. طُبقت الأداة على عينة الدراسة المكونة من (258) عضواً من أعضاء هيئة التدريس في كلية التربية الأساسية. أظهرت النتائج أن المتوسطات تراوحت بين (2.21–2.96)؛ إذ جاءت المكتبات السحابية الرقمية بأعلى متوسط حسابي بلغ (2.96) وبأهمية نسبية (49%).'

assert.equal(
  inferResearchSample(cloudComputingAbstract),
  'طُبقت الأداة على عينة الدراسة المكونة من (258) عضواً من أعضاء هيئة التدريس في كلية التربية الأساسية',
  'يجب أخذ جملة العينة لا المتوسط الحسابي الذي يليها',
)
assert.equal(cleanResearchSample('بلغ (2'), '', 'القوس المبتور لا يصبح عينة')
assert.equal(cleanResearchSample('بلغ المتوسط الحسابي (2.96)'), '', 'المتوسط الحسابي ليس عينة')
assert.equal(inferResearchSample('بلغ المتوسط الحسابي للأداة ككل (3.31).'), '', 'لا تُستنتج عينة من النتائج الإحصائية')
assert.equal(isPlausibleResearchSample('تكونت عينة الدراسة من 395 طالباً وطالبة.', { requireNumber: true }), true)
assert.equal(cleanResearchSample('نطاق الدراسة: جامعات دولة الكويت'), 'نطاق الدراسة: جامعات دولة الكويت', 'نطاق الدراسة النوعي صالح ولو لم يذكر عدداً')
assert.equal(
  splitResearchSentences('أظهرت النتائج أن المتوسطات تراوحت بين (2.21–2.96)؛ وبلغ المتوسط الكلي (2.31). وأظهرت النتائج عدم وجود فروق.')[0],
  'أظهرت النتائج أن المتوسطات تراوحت بين (2.21–2.96)؛ وبلغ المتوسط الكلي (2.31)',
  'النقطة العشرية لا تقطع الجملة العلمية',
)

console.log('✔ research sample integrity: valid scope only; statistical fragments rejected')

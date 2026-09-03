/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(${name}) / <alpha-value>)`

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: v('--c-canvas'),
        ink: v('--c-ink'),
        soft: v('--c-soft'),
        accent: v('--c-accent'),
        'accent-deep': v('--c-accent-deep'),
        wash: v('--c-wash'),
        hair: 'var(--c-hair)',
      },
      fontFamily: {
        display: ['"El Messiri"', 'serif'],
        sans: ['"Tajawal"', 'system-ui', 'sans-serif'],
      },
      maxWidth: { shell: '1140px' },
      /* سلّم نصف القطر — كان 12px لكل شيء، فيفقد سلّمُ الارتفاع إحدى إشاراته:
         الحقلُ الصغير والسطحُ الكبير بالانحناء نفسه. الآن ثلاث درجات قريبة
         بعضها من بعض حتى تبقى اللغة واحدة: الصغير أدقّ، والكبير أهدأ. */
      borderRadius: { lg: '8px', xl: '12px', '2xl': '14px', '3xl': '16px' },
    },
  },
  plugins: [],
}

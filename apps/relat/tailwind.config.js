import preset from '../../tailwind.preset.js';

/** @type {import('tailwindcss').Config} */
export default {
  presets: [preset],
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
    // UI compartilhada de geomonitor consumida via alias '@app' — precisa
    // entrar no scan ou as classes dos primitivos somem do CSS do relat.
    '../../src/components/**/*.{js,jsx}',
    '../../src/context/**/*.{js,jsx}',
  ],
  plugins: [],
}

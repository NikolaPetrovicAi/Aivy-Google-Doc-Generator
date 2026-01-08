/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      spacing: {
        '67': '16.75rem', // Custom value for 67px (67 * 0.25rem = 16.75rem)
        '9': '2.25rem', // Custom value for mr-9
      }
    }
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};

export default config;

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./templates/**/*.{html,js}"],
  theme: {
    extend: {
      fontFamily: {
        "sans": ["CabinetGrotesk"]
      },
    },
  },
  plugins: [],
};

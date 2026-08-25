```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],

  theme: {
    extend: {
      colors: {
        washek: {
          blue: "#3f5f91",
          dark: "#05070b",
        },
      },
    },
  },

  plugins: [],
};
```

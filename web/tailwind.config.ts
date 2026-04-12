/** @type {import('tailwindcss').Config} */
export default {
    content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
    theme: {
        extend: {
            fontFamily: {
                sans: ["Inter", "system-ui", "sans-serif"],
            },
            colors: {
                primary: {
                    50: "#f0faf4",
                    100: "#dcf2e6",
                    200: "#bce5d0",
                    300: "#8dd0b2",
                    400: "#58b48e",
                    500: "#339970",
                    600: "#237a58",
                    700: "#1c6147",
                    800: "#194e3a",
                    900: "#163f30",
                    950: "#0c2a1f",
                },
            },
            borderRadius: {
                "2xl": "1rem",
                "3xl": "1.5rem",
            },
        },
    },
    plugins: [],
};

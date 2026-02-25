/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            screens: {
                'xs': '475px',
            },
            colors: {
                ch: {
                    bg: '#0a0a0f',
                    surface: '#12121a',
                    'surface-2': '#1a1a28',
                    border: '#2a2a3a',
                    cyan: '#00f5d4',
                    magenta: '#f72585',
                    purple: '#7b2ff7',
                    text: '#e8e8f0',
                    muted: '#6b6b80',
                }
            },
        },
    },
    plugins: [],
}

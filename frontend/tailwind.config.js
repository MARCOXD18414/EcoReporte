/** Paleta "Amor x Carmen": Azul Marino + Naranja Cálido */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        marino: {
          50: '#EEF3FA',
          100: '#D6E1F1',
          200: '#ADC3E3',
          300: '#7C9DCD',
          400: '#4D74B0',
          500: '#2F5591',
          600: '#22437A',
          700: '#1B3664',
          800: '#14294B',
          900: '#0C1B33',
          950: '#071122',
        },
        naranja: {
          50: '#FFF6EC',
          100: '#FFE8CF',
          200: '#FFCF9C',
          300: '#FFB466',
          400: '#FF9F3D',
          500: '#F7891F',
          600: '#DE7012',
          700: '#B4560D',
          800: '#8C4210',
          900: '#713711',
        },
      },
      fontFamily: {
        sans: ['Poppins', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        tarjeta: '0 4px 20px -6px rgba(12, 27, 51, 0.18)',
      },
    },
  },
  plugins: [],
};

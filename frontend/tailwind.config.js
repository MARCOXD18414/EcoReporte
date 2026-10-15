/**
 * Paleta EcoReporta — “Por un medio ambiente mejor”
 *  Morado principal #880EBA · Morado oscuro #6F04A2 · Magenta #D40A8C · Amarillo #ECE524
 *  Turquesa #10DEAD · Turquesa claro #4BE6C1 · Lila #BA7CEE · Lila claro #CEA3F3
 *  Morado tinta (texto oscuro) #3B0A57 · Blanco rosado (texto claro) #F9EEF9 · Blanco #FFFFFF
 */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Base: fondos, navegación y texto
        morado: {
          50: '#F9EEF9', // blanco rosado
          100: '#F1DEF8',
          200: '#CEA3F3', // lila claro
          300: '#BA7CEE', // lila
          400: '#A65BD8',
          500: '#8F45B8',
          600: '#7A2FA3',
          700: '#880EBA', // morado principal
          800: '#6F04A2', // morado oscuro
          900: '#3B0A57', // morado tinta
          950: '#26053A',
        },
        // Acento y acciones principales / nivel crítico
        magenta: {
          50: '#FDEAF5',
          100: '#FAD0EA',
          200: '#F3A1D3',
          300: '#EA6DB9',
          400: '#E03BA2',
          500: '#D40A8C', // magenta
          600: '#B00874',
          700: '#8C065C',
          800: '#6A0546',
          900: '#4A0331',
        },
        // Éxito, en línea, nivel bajo, resuelto
        turquesa: {
          50: '#ECFDF8',
          100: '#C9F8EC',
          200: '#8FF0D8',
          300: '#4BE6C1', // turquesa claro
          400: '#2BE2B6',
          500: '#10DEAD', // turquesa
          600: '#0BB58C',
          700: '#08876A',
          800: '#065C48',
          900: '#04392D',
        },
        // Advertencia, nivel moderado, en proceso
        amarillo: {
          50: '#FDFCE6',
          100: '#FAF8C2',
          200: '#F5F28A',
          300: '#F0EB55',
          400: '#ECE524', // amarillo
          500: '#D4CD12',
          600: '#A9A30D',
          700: '#7E790A',
          800: '#555207',
          900: '#2E2C04',
        },
      },
      fontFamily: {
        sans: ['Poppins', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        tarjeta: '0 4px 20px -6px rgba(59, 10, 87, 0.22)',
      },
    },
  },
  plugins: [],
};

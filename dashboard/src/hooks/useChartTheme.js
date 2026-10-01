import { useTheme } from '../contexts/ThemeContext';

// Ye active app theme ko ApexCharts ke color aur mode options mein map karta hai.
export function useChartTheme() {
    const { currentTheme } = useTheme();
    const isLight = currentTheme === 'light';

    return {
        mode: isLight ? 'light' : 'dark',
        labelColor: isLight ? '#647169' : '#a3ada7',
        gridColor: isLight ? 'rgba(26,39,32,0.12)' : 'rgba(233,239,231,0.12)',
        tooltipTheme: isLight ? 'light' : 'dark',
        strokeColor: isLight ? '#1a2720' : '#101715',
    };
}

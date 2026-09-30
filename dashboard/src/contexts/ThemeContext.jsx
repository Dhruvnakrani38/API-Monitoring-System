import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

// Ye hook theme context deta hai aur provider na ho to clear error throw karta hai.
export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}

const themes = {
    purple: {
        name: 'Purple',
        description: 'Beautiful purple theme with glass effects',
        class: 'theme-purple'
    },
    light: {
        name: 'Light',
        description: 'Clean white theme for better readability',
        class: 'theme-light'
    }
};

// Ye provider selected theme ko app bhar manage aur persist karta hai.
export function ThemeProvider({ children }) {
    const [currentTheme, setCurrentTheme] = useState(() => {
        // Pehle saved theme padho; invalid value par default theme rakho.
        if (typeof window !== 'undefined') {
            const savedTheme = localStorage.getItem('app-theme');
            return (savedTheme && themes[savedTheme]) ? savedTheme : 'purple';
        }
        return 'purple';
    });

    // Root element ki theme classes sync karke selection local storage mein save karo.
    useEffect(() => {
        const root = document.documentElement;

        Object.values(themes).forEach(theme => {
            root.classList.remove(theme.class);
        });

        root.classList.add(themes[currentTheme].class);
        localStorage.setItem('app-theme', currentTheme);
    }, [currentTheme]);

    // Sirf configured theme ko active state mein set hone do.
    const switchTheme = (themeName) => {
        if (themes[themeName]) {
            setCurrentTheme(themeName);
        }
    };

    const value = {
        currentTheme,
        themes,
        switchTheme,
        theme: themes[currentTheme]
    };

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
}
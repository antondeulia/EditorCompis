"use client";

import { useContext } from "react";
import styles from "./ThemeToggle.module.css";
import { ThemeContext } from "@/components/theme/ThemeProvider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useContext(ThemeContext);

  return (
    <button type="button" onClick={toggleTheme} className={styles.themeToggle}>
      Theme: {theme}
    </button>
  );
}

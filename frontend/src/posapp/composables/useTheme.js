import { ref, computed } from "vue";

// Global theme state
const isDarkMode = ref(false);
const theme = ref("light");

// Theme preference storage key and valid options
const THEME_STORAGE_KEY = "posawesome_theme_preference";
const THEME_PREFERENCE_VALUES = ["light", "dark", "automatic"];

const normalizeThemePreference = (input) => {
	if (!input) {
		return "light";
	}

	const normalized = String(input).trim().toLowerCase();

	if (normalized === "auto") {
		return "automatic";
	}

	if (THEME_PREFERENCE_VALUES.includes(normalized)) {
		return normalized;
	}

	return "light";
};

// Global Vuetify instance reference (set during app initialization)
let vuetifyInstance = null;

/**
 * Set the global Vuetify instance (called from the theme plugin)
 */
export function setVuetifyInstance(vuetify) {
	vuetifyInstance = vuetify;
}

/**
 * Global theme composable for POSAwesome
 * Provides centralized dark mode management across all components
 */
export function useTheme() {
	// Initialize theme from DOM or localStorage
	const initializeTheme = () => {
		const root = document.documentElement;
		const domTheme = root.getAttribute("data-theme-mode") || root.getAttribute("data-theme");

		if (domTheme) {
			setTheme(domTheme === "automatic" ? getSystemTheme() : domTheme);
		} else {
			// Fallback to localStorage or system preference
			const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
			if (savedTheme) {
				setTheme(savedTheme);
			} else {
				setTheme(getSystemTheme());
			}
		}
	};

	// Get system theme preference
	const getSystemTheme = () => {
		return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
	};

	// Set theme and update all systems
	const setTheme = (newTheme) => {
		const preference = normalizeThemePreference(newTheme);
		const resolvedTheme = preference === "automatic" ? getSystemTheme() : preference;

		theme.value = resolvedTheme;
		isDarkMode.value = resolvedTheme === "dark";

		// Update Vuetify theme if available
		if (vuetifyInstance?.theme?.global) {
			const availableThemes = Object.keys(vuetifyInstance.theme.global.themes?.value || {});
			const vuetifyThemeName = availableThemes.includes(resolvedTheme)
				? resolvedTheme
				: availableThemes[0] || resolvedTheme;
			vuetifyInstance.theme.global.name.value = vuetifyThemeName;
		}

		// Update DOM attributes
		const root = document.documentElement;
		root.setAttribute("data-theme", resolvedTheme);
		root.setAttribute("data-theme-mode", preference);

		// Update CSS custom properties for immediate effect
		updateCSSProperties(resolvedTheme);

		// Force immediate DOM update to prevent caching lag
		forceStyleRefresh();

		// Save preference
		localStorage.setItem(THEME_STORAGE_KEY, preference);

		// Sync with Frappe if available
		syncWithFrappe(preference);
	};

	// Toggle between light and dark themes
	const toggleTheme = () => {
		const newTheme = isDarkMode.value ? "light" : "dark";
		setTheme(newTheme);
	};

	// Update CSS custom properties for immediate theme changes
	const updateCSSProperties = (themeName) => {
		const root = document.documentElement;

		if (themeName === "dark") {
			// NMG dark (ink) theme
			root.style.setProperty("--pos-bg-primary", "#0A0C16");
			root.style.setProperty("--pos-bg-secondary", "#0B0E14");
			root.style.setProperty("--pos-bg-tertiary", "#121526");
			root.style.setProperty("--pos-surface", "#121526");
			root.style.setProperty("--pos-surface-variant", "#1A1F35");

			root.style.setProperty("--pos-text-primary", "#ffffff");
			root.style.setProperty("--pos-text-secondary", "#b8bcc8");
			root.style.setProperty("--pos-text-disabled", "#6b7080");

			root.style.setProperty("--pos-primary", "#304FF3");
			root.style.setProperty("--pos-primary-variant", "#5B73F5");
			root.style.setProperty("--pos-secondary", "#00F0FF");

			root.style.setProperty("--pos-border", "rgba(48, 79, 243, 0.2)");
			root.style.setProperty("--pos-divider", "rgba(255, 255, 255, 0.08)");
			root.style.setProperty("--pos-shadow", "rgba(0, 0, 0, 0.45)");
			root.style.setProperty("--pos-glow", "0 0 14px rgba(48, 79, 243, 0.35)");

			root.style.setProperty("--pos-card-bg", "#121526");
			root.style.setProperty("--pos-input-bg", "#1A1F35");
			root.style.setProperty("--pos-hover-bg", "rgba(48, 79, 243, 0.14)");
			root.style.setProperty("--pos-navbar-bg", "#121526");
			root.style.setProperty("--pos-sidebar-bg", "#0A0C16");
		} else {
			// NMG light theme
			root.style.setProperty("--pos-bg-primary", "#ffffff");
			root.style.setProperty("--pos-bg-secondary", "#f5f6fa");
			root.style.setProperty("--pos-bg-tertiary", "#e8ecff");
			root.style.setProperty("--pos-surface", "#ffffff");
			root.style.setProperty("--pos-surface-variant", "#f0f1f5");

			root.style.setProperty("--pos-text-primary", "#0B0E14");
			root.style.setProperty("--pos-text-secondary", "#5a5f6e");
			root.style.setProperty("--pos-text-disabled", "#9e9e9e");

			root.style.setProperty("--pos-primary", "#304FF3");
			root.style.setProperty("--pos-primary-variant", "#1A2D8F");
			root.style.setProperty("--pos-secondary", "#00F0FF");

			root.style.setProperty("--pos-border", "rgba(11, 14, 20, 0.12)");
			root.style.setProperty("--pos-divider", "rgba(11, 14, 20, 0.06)");
			root.style.setProperty("--pos-shadow", "rgba(48, 79, 243, 0.08)");
			root.style.setProperty("--pos-glow", "0 0 12px rgba(48, 79, 243, 0.25)");

			root.style.setProperty("--pos-card-bg", "#ffffff");
			root.style.setProperty("--pos-input-bg", "#f0f1f5");
			root.style.setProperty("--pos-hover-bg", "rgba(48, 79, 243, 0.06)");
			root.style.setProperty("--pos-navbar-bg", "#ffffff");
			root.style.setProperty("--pos-sidebar-bg", "#f5f6fa");
		}

		// Minimal DOM recalculation
		requestAnimationFrame(() => {
			root.offsetHeight;
		});
	};

	// Minimal style refresh - remove heavy DOM manipulation
	const forceStyleRefresh = () => {
		// Minimal reflow trigger
		const root = document.documentElement;
		requestAnimationFrame(() => {
			root.offsetHeight; // Single reflow trigger
		});
	};

	// Sync theme with Frappe system
	const syncWithFrappe = (themeName) => {
		// Update Frappe UI if available
		if (window.frappe?.ui?.set_theme) {
			window.frappe.ui.set_theme(themeName);
		}

		// Save to user preferences via API
		if (window.frappe?.xcall) {
			window.frappe
				.xcall("frappe.core.doctype.user.user.switch_theme", {
					theme: themeName.charAt(0).toUpperCase() + themeName.slice(1),
				})
				.catch(() => {
					// Ignore API errors - theme still works locally
				});
		}
	};

	// Listen for system theme changes
	const setupSystemThemeWatcher = () => {
		const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
		mediaQuery.addEventListener("change", () => {
			const currentMode = document.documentElement.getAttribute("data-theme-mode");
			if (currentMode === "automatic") {
				setTheme("automatic");
			}
		});
	};

	// Watch for DOM attribute changes (compatibility with existing theme plugin)
	const setupDOMWatcher = () => {
		const observer = new MutationObserver((mutations) => {
			mutations.forEach((mutation) => {
				if (mutation.type === "attributes") {
					const root = document.documentElement;
					const preference =
						normalizeThemePreference(
							root.getAttribute("data-theme-mode") || root.getAttribute("data-theme")
						);

					if (preference && preference !== theme.value) {
						const resolvedTheme = preference === "automatic" ? getSystemTheme() : preference;

						if (resolvedTheme !== theme.value) {
							theme.value = resolvedTheme;
							isDarkMode.value = resolvedTheme === "dark";
							updateCSSProperties(resolvedTheme);
						}
					}
				}
			});
		});

		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["data-theme", "data-theme-mode"],
		});

		return observer;
	};

	// Computed properties for common theme values
	const themeColors = computed(() => {
		return {
			background: isDarkMode.value ? "#0A0C16" : "#ffffff",
			surface: isDarkMode.value ? "#121526" : "#ffffff",
			surfaceVariant: isDarkMode.value ? "#1A1F35" : "#f0f1f5",
			primary: "#304FF3",
			textPrimary: isDarkMode.value ? "#ffffff" : "#0B0E14",
			textSecondary: isDarkMode.value ? "#b8bcc8" : "#5a5f6e",
			border: isDarkMode.value ? "rgba(48, 79, 243, 0.2)" : "rgba(11, 14, 20, 0.12)",
			cardBackground: isDarkMode.value ? "#121526" : "#ffffff",
		};
	});

	// Initialize theme on first use
	let initialized = false;
	if (!initialized) {
		initializeTheme();
		setupSystemThemeWatcher();
		setupDOMWatcher();
		initialized = true;
	}

	return {
		// State
		isDark: computed(() => isDarkMode.value),
		theme: computed(() => theme.value),
		themeColors,

		// Methods
		toggleTheme,
		setTheme,

		// For backwards compatibility
		current: computed(() => theme.value),
		toggle: toggleTheme,
	};
}

// Export singleton instance for direct usage
const globalTheme = useTheme();
export default globalTheme;

import { createVuetify } from "vuetify";
import { createApp } from "vue";
import Dexie from "dexie/dist/dexie.mjs";
import VueDatePicker from "@vuepic/vue-datepicker";
import "@vuepic/vue-datepicker/dist/main.css";
import "../../../posawesome/public/css/rtl.css";
import "../style.css";
import "./styles/theme.css";
import eventBus from "./bus";
import themePlugin from "./plugins/theme.js";
import { pinia } from "./stores/index.js";
import "../sw-updater.js"; // Initialize service worker auto-updater
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";
import Home from "./Home.vue";
import { attachProfilerHelpers, initLongTaskObserver, isPerfEnabled } from "./utils/perf.js";

attachProfilerHelpers();

// Expose Dexie globally for libraries that expect a global Dexie instance
if (typeof window !== "undefined" && !window.Dexie) {
	window.Dexie = Dexie;
}

// Ensure frappe is available
if (typeof frappe === "undefined") {
	console.error("Frappe is not defined");
} else {
	frappe.provide("frappe.PosApp");
}

frappe.PosApp.posapp = class {
	constructor({ parent }) {
		this.$parent = $(document);
		this.page = parent?.page || parent;
		this.make_body();
	}
	make_body() {
		this.$el = this.$parent.find(".main-section");
		const vuetify = createVuetify({
			components,
			directives,
			locale: {
				rtl: frappe.utils.is_rtl(),
			},
			theme: {
				defaultTheme: "light",
				themes: {
					light: {
						colors: {
							background: "#FFFFFF",
							surface: "#FFFFFF",
							primary: "#304FF3",
							primaryVariant: "#1A2D8F",
							secondary: "#00F0FF",
							accent: "#304FF3",
							success: "#66BB6A",
							info: "#304FF3",
							warning: "#FF9800",
							error: "#E86674",
							orange: "#E65100",
							golden: "#A68C59",
							badge: "#F5528C",
							customPrimary: "#1A2D8F",
						},
					},
					dark: {
						dark: true,
						colors: {
							background: "#0A0C16",
							surface: "#121526",
							primary: "#304FF3",
							primaryVariant: "#5B73F5",
							secondary: "#00F0FF",
							accent: "#304FF3",
							success: "#66BB6A",
							info: "#5B73F5",
							warning: "#FF9800",
							error: "#CF6679",
							orange: "#FF6F00",
							golden: "#A68C59",
							badge: "#F5528C",
							customPrimary: "#5B73F5",
							onBackground: "#FFFFFF",
							onSurface: "#FFFFFF",
							divider: "#1A1F35",
						},
					},
				},
			},
		});
		const app = createApp(Home);
		app.component("VueDatePicker", VueDatePicker);
		app.use(pinia);
		app.use(eventBus);
		app.use(vuetify);
		app.use(themePlugin, { vuetify });
		app.mount(this.$el[0]);

		if (isPerfEnabled()) {
			initLongTaskObserver("posapp");
		}

		if (!document.querySelector('link[rel="manifest"]')) {
			const link = document.createElement("link");
			link.rel = "manifest";
			link.href = "/manifest.json";
			document.head.appendChild(link);
		}

		if (
			("serviceWorker" in navigator && window.location.protocol === "https:") ||
			window.location.hostname === "localhost" ||
			window.location.hostname === "127.0.0.1"
		) {
			navigator.serviceWorker
				.register("/assets/posawesome/dist/www/sw.js")
				.then((registration) => {
					console.log("SW registered successfully", registration);
				})
				.catch((err) => console.error("SW registration failed", err));
		}
	}
	setup_header() {}
};

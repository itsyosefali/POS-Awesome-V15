import { defineStore } from "pinia";
import { ref, computed } from "vue";
import {
	db,
	checkDbHealth,
	setSupplierStorage,
	memoryInitPromise,
	getSuppliersLastSync,
	setSuppliersLastSync,
	getSupplierStorageCount,
	clearSupplierStorage,
	isOffline,
} from "../../offline/index.js";

const PAGE_SIZE = 1000;

function normalizeSearchTerm(term) {
	if (typeof term !== "string") {
		return "";
	}
	return term.trim();
}

function normalizeProfile(profile) {
	if (!profile) return null;

	let resolved = profile;
	if (profile.pos_profile) {
		resolved = profile.pos_profile;
	}

	if (typeof resolved === "string") {
		const trimmed = resolved.trim();
		if (!trimmed) return null;
		if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
			try {
				return JSON.parse(trimmed);
			} catch (err) {
				console.error("Failed to parse POS profile JSON", err);
				return null;
			}
		}
		return { name: trimmed };
	}
	return resolved;
}

function getSerializedProfile(profile) {
	if (!profile) return null;

	if (typeof profile === "string") {
		const trimmed = profile.trim();
		if (!trimmed) return null;
		if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
			return trimmed;
		}
		return JSON.stringify({ name: trimmed });
	}

	try {
		return JSON.stringify(profile);
	} catch (err) {
		console.error("Failed to serialize POS profile", err);
		return null;
	}
}

export const useSuppliersStore = defineStore("suppliers", () => {
	const suppliers = ref([]);
	const filteredSuppliers = computed(() => suppliers.value);

	const selectedSupplier = ref(null);
	const supplierInfo = ref({});

	const searchTerm = ref("");
	const page = ref(0);
	const hasMore = ref(true);

	const loadingSuppliers = ref(false);
	const suppliersLoaded = ref(false);
	const isSupplierBackgroundLoading = ref(false);
	const pendingSupplierSearch = ref(null);

	const loadProgress = ref(0);
	const totalSupplierCount = ref(0);
	const loadedSupplierCount = ref(0);

	const posProfile = ref(null);
	const refreshToken = ref(0);

	function ensureDatabase() {
		return (async () => {
			await memoryInitPromise;
			await checkDbHealth();
			if (!db.isOpen()) {
				await db.open();
			}
		})();
	}

	function resetPagination() {
		page.value = 0;
		hasMore.value = true;
		suppliers.value = [];
	}

	function setPosProfile(profile) {
		posProfile.value = normalizeProfile(profile);
	}

	function setSelectedSupplier(name) {
		selectedSupplier.value = name || null;
	}

	function setSupplierInfo(info) {
		supplierInfo.value = info || {};
	}

	function requestSupplierRefresh() {
		refreshToken.value += 1;
	}

	async function performSearch({ append = false } = {}) {
		await ensureDatabase();

		let collection = db.table("suppliers");
		const normalizedTerm = normalizeSearchTerm(searchTerm.value);

		if (normalizedTerm) {
			const searchParts = normalizedTerm.toLowerCase().split(/\s+/).filter(Boolean);
			collection = collection.filter((supplier) => {
				if (!supplier) return false;
				const values = [
					supplier.supplier_name,
					supplier.name,
					supplier.mobile_no,
					supplier.email_id,
					supplier.tax_id,
				]
					.filter((v) => v !== null && v !== undefined)
					.map((v) => String(v).toLowerCase());

				if (!searchParts.length) return true;
				return searchParts.every((part) => values.some((value) => value.includes(part)));
			});
		}

		const offset = page.value * PAGE_SIZE;
		const results = await collection.offset(offset).limit(PAGE_SIZE).toArray();

		if (append) {
			suppliers.value = [...suppliers.value, ...results];
		} else {
			suppliers.value = results;
		}

		hasMore.value = results.length === PAGE_SIZE;
		if (hasMore.value) {
			page.value += 1;
		}

		return results.length;
	}

	async function searchSuppliers(term = "", append = false) {
		if (!append) {
			searchTerm.value = normalizeSearchTerm(term);
			resetPagination();
		}
		return performSearch({ append });
	}

	async function queueSearch(term) {
		const normalized = normalizeSearchTerm(term);
		if (isSupplierBackgroundLoading.value) {
			pendingSupplierSearch.value = normalized;
			return null;
		}
		return searchSuppliers(normalized, false);
	}

	async function loadMoreSuppliers() {
		if (loadingSuppliers.value) {
			return 0;
		}
		const count = await performSearch({ append: true });
		if (count === PAGE_SIZE) {
			return count;
		}
		// Background sync is implemented below (similar to customersStore), so just return.
		return count;
	}

	async function fetchSupplierPage(startAfter, modifiedAfter, limit) {
		const serializedProfile = getSerializedProfile(posProfile.value);
		return new Promise((resolve, reject) => {
			if (!serializedProfile) {
				resolve([]);
				return;
			}

			frappe.call({
				method: "posawesome.posawesome.api.suppliers.get_supplier_names",
				args: {
					pos_profile: serializedProfile,
					modified_after: modifiedAfter,
					limit,
					start_after: startAfter,
				},
				callback: (r) => resolve(r.message || []),
				error: (err) => {
					console.error("Failed to fetch suppliers", err);
					reject(err);
				},
			});
		});
	}

	async function backgroundLoadSuppliers(startAfter, syncSince) {
		if (!posProfile.value || isOffline()) return;

		const serializedProfile = getSerializedProfile(posProfile.value);
		if (!serializedProfile) return;

		const limit = PAGE_SIZE;
		isSupplierBackgroundLoading.value = true;
		try {
			let cursor = startAfter;
			while (cursor) {
				const rows = await fetchSupplierPage(cursor, syncSince, limit);
				if (rows.length) {
					await setSupplierStorage(rows);
					loadedSupplierCount.value += rows.length;
					if (totalSupplierCount.value) {
						loadProgress.value = Math.min(
							99,
							Math.round((loadedSupplierCount.value / totalSupplierCount.value) * 100),
						);
					}
				}

				if (rows.length === limit) {
					cursor = rows[rows.length - 1]?.name || null;
				} else {
					cursor = null;
					setSuppliersLastSync(new Date().toISOString());
					loadProgress.value = 100;
					suppliersLoaded.value = true;
				}
			}
		} catch (err) {
			console.error("Failed to background load suppliers", err);
		} finally {
			isSupplierBackgroundLoading.value = false;
			if (pendingSupplierSearch.value !== null) {
				const term = pendingSupplierSearch.value;
				pendingSupplierSearch.value = null;
				await searchSuppliers(term);
			}
		}
	}

	async function verifyServerSupplierCount() {
		if (!posProfile.value || isOffline()) return;

		try {
			const localCount = await getSupplierStorageCount();
			const serializedProfile = getSerializedProfile(posProfile.value);
			if (!serializedProfile) return;

			const response = await frappe.call({
				method: "posawesome.posawesome.api.suppliers.get_suppliers_count",
				args: { pos_profile: serializedProfile },
			});
			const serverCount = response.message || 0;
			totalSupplierCount.value = serverCount;
			loadedSupplierCount.value = localCount;
			loadProgress.value = serverCount
				? Math.round((localCount / serverCount) * 100)
				: 0;

			if (serverCount > localCount) {
				const syncSince = getSuppliersLastSync();
				const rows = await fetchSupplierPage(null, syncSince, PAGE_SIZE);
				if (rows.length) {
					await setSupplierStorage(rows);
					loadedSupplierCount.value += rows.length;
				}

				const startAfter = rows.length === PAGE_SIZE ? rows[rows.length - 1]?.name || null : null;
				if (startAfter) {
					await backgroundLoadSuppliers(startAfter, syncSince);
				} else {
					setSuppliersLastSync(new Date().toISOString());
					loadProgress.value = 100;
					suppliersLoaded.value = true;
				}

				await searchSuppliers(searchTerm.value);
			} else if (serverCount < localCount) {
				await clearSupplierStorage();
				setSuppliersLastSync(null);
				resetPagination();
				await searchSuppliers(searchTerm.value);
			}
		} catch (err) {
			console.error("Error verifying supplier count:", err);
		}
	}

	async function get_supplier_names() {
		if (!posProfile.value) return;

		const serializedProfile = getSerializedProfile(posProfile.value);
		if (!serializedProfile) return;

		const localCount = await getSupplierStorageCount();
		if (localCount > 0) {
			suppliersLoaded.value = true;
			await searchSuppliers(searchTerm.value);
			await verifyServerSupplierCount();
			return;
		}

		const syncSince = getSuppliersLastSync();
		loadProgress.value = 0;
		loadingSuppliers.value = true;
		try {
			const countResponse = await frappe.call({
				method: "posawesome.posawesome.api.suppliers.get_suppliers_count",
				args: { pos_profile: serializedProfile },
			});
			totalSupplierCount.value = countResponse.message || 0;

			const rows = await fetchSupplierPage(null, syncSince, PAGE_SIZE);
			if (rows.length) {
				await setSupplierStorage(rows);
			}

			loadedSupplierCount.value = rows.length;
			if (totalSupplierCount.value) {
				loadProgress.value = Math.min(
					100,
					Math.round((loadedSupplierCount.value / totalSupplierCount.value) * 100),
				);
			}

			const startAfter = rows.length === PAGE_SIZE ? rows[rows.length - 1]?.name || null : null;
			if (startAfter) {
				await backgroundLoadSuppliers(startAfter, syncSince);
			} else {
				setSuppliersLastSync(new Date().toISOString());
				loadProgress.value = 100;
				suppliersLoaded.value = true;
			}

			await searchSuppliers(searchTerm.value);
		} catch (err) {
			console.error("Failed to fetch suppliers:", err);
		} finally {
			loadingSuppliers.value = false;
		}
	}

	async function addOrUpdateSupplier(supplier) {
		if (!supplier || !supplier.name) return;

		const existingIndex = suppliers.value.findIndex((s) => s.name === supplier.name);
		if (existingIndex !== -1) {
			const updated = [...suppliers.value];
			updated.splice(existingIndex, 1, supplier);
			suppliers.value = updated;
		} else {
			suppliers.value = [...suppliers.value, supplier];
		}

		await setSupplierStorage([supplier]);
		setSelectedSupplier(supplier.name);
		requestSupplierRefresh();
	}

	function clearLocalState() {
		resetPagination();
		selectedSupplier.value = null;
		supplierInfo.value = {};
		loadProgress.value = 0;
		totalSupplierCount.value = 0;
		loadedSupplierCount.value = 0;
		suppliersLoaded.value = false;
	}

	return {
		suppliers,
		filteredSuppliers,
		selectedSupplier,
		supplierInfo,
		searchTerm,
		page,
		hasMore,
		loadingSuppliers,
		suppliersLoaded,
		isSupplierBackgroundLoading,
		pendingSupplierSearch,
		loadProgress,
		totalSupplierCount,
		loadedSupplierCount,
		posProfile,
		refreshToken,
		setPosProfile,
		setSelectedSupplier,
		setSupplierInfo,
		searchSuppliers,
		queueSearch,
		loadMoreSuppliers,
		verifyServerSupplierCount,
		get_supplier_names,
		backgroundLoadSuppliers,
		addOrUpdateSupplier,
		requestSupplierRefresh,
		clearLocalState,
	};
});


<template>
	<v-row class="pa-4" dense>
		<v-col cols="12" md="6">
			<v-text-field
				v-model="search"
				density="compact"
				variant="outlined"
				class="pos-themed-input"
				:label="__('Search Purchase Invoices (name/supplier)')"
				hide-details
				clearable
			/>
		</v-col>
		<v-col cols="12" md="6" class="d-flex justify-end align-center">
			<v-btn color="success" variant="tonal" class="mr-2" @click="goNew">
				<v-icon start>mdi-plus</v-icon>
				{{ __("Add Purchase Invoice") }}
			</v-btn>
			<v-btn color="primary" variant="tonal" :loading="loading" @click="load(true)">
				<v-icon start>mdi-refresh</v-icon>
				{{ __("Refresh") }}
			</v-btn>
		</v-col>

		<v-col cols="12">
			<v-data-table
				:headers="headers"
				:items="rows"
				item-key="name"
				:loading="loading"
				class="elevation-1"
			>
				<template v-slot:item.actions="{ item }">
					<v-btn size="small" color="primary" variant="text" @click="printInvoice(item.raw.name)">
						<v-icon start size="small">mdi-printer</v-icon>
						{{ __("Print") }}
					</v-btn>
				</template>
			</v-data-table>

			<div class="text-center mt-3">
				<v-btn
					color="primary"
					variant="outlined"
					:disabled="loading || !hasMore"
					:loading="loadingMore"
					@click="loadMore"
				>
					{{ hasMore ? __("Load more") : __("No more invoices") }}
				</v-btn>
			</div>
		</v-col>
	</v-row>
</template>

<script>
/* global frappe, __ */
import { computed, getCurrentInstance, onMounted, ref, watch } from "vue";
import { getOpeningStorage } from "../../../offline/index.js";
import _ from "lodash";

export default {
	name: "PurchaseInvoicePage",
	setup() {
		const { proxy } = getCurrentInstance();
		const eventBus = proxy?.eventBus;

		const rows = ref([]);
		const loading = ref(false);
		const loadingMore = ref(false);
		const hasMore = ref(true);
		const pageSize = 50;
		const offset = ref(0);

		const search = ref("");
		const company = ref(null);

		const headers = computed(() => [
			{ title: __("Invoice"), key: "name", align: "start", sortable: true },
			{ title: __("Date"), key: "posting_date", align: "start", sortable: true },
			{ title: __("Supplier"), key: "supplier_name", align: "start", sortable: true },
			{ title: __("Amount"), key: "grand_total", align: "end", sortable: true },
			{ title: __("Currency"), key: "currency", align: "start", sortable: true },
			{ title: __("Actions"), key: "actions", align: "end", sortable: false },
		]);

		const buildFilters = () => {
			const filters = { docstatus: 1 };
			if (company.value) {
				filters.company = company.value;
			}
			return filters;
		};

		const fetchPage = async (reset = false) => {
			if (reset) {
				offset.value = 0;
				rows.value = [];
				hasMore.value = true;
			}
			if (!hasMore.value) return;

			const currentOffset = offset.value;
			const fields = ["name", "posting_date", "supplier_name", "grand_total", "currency"];

			const filters = buildFilters();

			let data = await frappe.db.get_list("Purchase Invoice", {
				fields,
				filters,
				order_by: "posting_date desc, modified desc",
				limit_start: currentOffset,
				limit: pageSize,
			});

			const term = (search.value || "").trim().toLowerCase();
			if (term) {
				data = (data || []).filter((row) => {
					const name = String(row.name || "").toLowerCase();
					const supplier = String(row.supplier_name || "").toLowerCase();
					return name.includes(term) || supplier.includes(term);
				});
			}

			rows.value = [...rows.value, ...(data || [])];
			offset.value = currentOffset + pageSize;
			hasMore.value = (data || []).length === pageSize;
		};

		const load = async (reset = false) => {
			loading.value = true;
			try {
				await fetchPage(reset);
			} finally {
				loading.value = false;
			}
		};

		const loadMore = async () => {
			if (!hasMore.value) return;
			loadingMore.value = true;
			try {
				await fetchPage(false);
			} finally {
				loadingMore.value = false;
			}
		};

		const printInvoice = (name) => {
			const url =
				frappe.urllib.get_base_url() +
				"/printview?doctype=" +
				encodeURIComponent("Purchase Invoice") +
				"&name=" +
				encodeURIComponent(name) +
				"&trigger_print=1";
			window.open(url, "Print");
		};

		const goNew = () => {
			eventBus?.emit("change-page", "Purchase Invoice (New)");
		};

		const debouncedReload = _.debounce(() => load(true), 250);
		watch(search, () => debouncedReload());

		onMounted(() => {
			const opening = getOpeningStorage();
			company.value = opening?.pos_profile?.company || null;
			load(true);
		});

		return { headers, rows, loading, loadingMore, hasMore, search, load, loadMore, printInvoice, goNew };
	},
};
</script>


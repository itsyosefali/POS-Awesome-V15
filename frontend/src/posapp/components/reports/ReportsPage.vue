<template>
	<v-row class="pa-4" dense>
		<v-col cols="12" md="4">
			<v-text-field
				v-model="fromDate"
				density="compact"
				variant="outlined"
				class="pos-themed-input"
				:label="__('From date (YYYY-MM-DD)')"
				hide-details
			/>
		</v-col>
		<v-col cols="12" md="4">
			<v-text-field
				v-model="toDate"
				density="compact"
				variant="outlined"
				class="pos-themed-input"
				:label="__('To date (YYYY-MM-DD)')"
				hide-details
			/>
		</v-col>
		<v-col cols="12" md="4" class="d-flex justify-end align-center">
			<v-btn color="primary" variant="tonal" :loading="loading" @click="loadSummary">
				<v-icon start>mdi-refresh</v-icon>
				{{ __("Refresh") }}
			</v-btn>
		</v-col>

		<v-col cols="12" md="4">
			<v-card class="pos-themed-card pa-3">
				<div class="text-subtitle-1">{{ __("Sales") }}</div>
				<div class="text-h6">{{ summary?.sales?.count || 0 }} {{ __("invoices") }}</div>
				<div class="text-body-2">{{ __("Total") }}: {{ formatMoney(summary?.sales?.grand_total) }}</div>
			</v-card>
		</v-col>

		<v-col cols="12" md="4">
			<v-card class="pos-themed-card pa-3">
				<div class="text-subtitle-1">{{ __("Returns") }}</div>
				<div class="text-h6">{{ summary?.returns?.count || 0 }} {{ __("invoices") }}</div>
				<div class="text-body-2">
					{{ __("Total") }}: {{ formatMoney(summary?.returns?.grand_total) }}
				</div>
			</v-card>
		</v-col>

		<v-col cols="12" md="4">
			<v-card class="pos-themed-card pa-3">
				<div class="text-subtitle-1">{{ __("Purchases") }}</div>
				<div class="text-h6">{{ summary?.purchase?.count || 0 }} {{ __("invoices") }}</div>
				<div class="text-body-2">
					{{ __("Total") }}: {{ formatMoney(summary?.purchase?.grand_total) }}
				</div>
			</v-card>
		</v-col>
	</v-row>
</template>

<script>
/* global __, frappe */
import { onMounted, ref } from "vue";
import { getOpeningStorage, isOffline } from "../../../offline/index.js";

export default {
	name: "ReportsPage",
	setup() {
		const today = frappe?.datetime?.nowdate?.() || new Date().toISOString().slice(0, 10);
		const fromDate = ref(today);
		const toDate = ref(today);
		const summary = ref(null);
		const loading = ref(false);

		const formatMoney = (val) => {
			const num = Number(val || 0);
			return Number.isFinite(num) ? num.toFixed(2) : "0.00";
		};

		const loadSummary = async () => {
			if (isOffline()) {
				return;
			}

			const opening = getOpeningStorage();
			const posProfile = opening?.pos_profile?.name || null;
			const company = opening?.pos_profile?.company || opening?.company?.name || opening?.company || null;

			loading.value = true;
			try {
				const resp = await frappe.call({
					method: "posawesome.posawesome.api.reports.get_pos_summary",
					args: {
						company,
						pos_profile: posProfile,
						from_date: fromDate.value,
						to_date: toDate.value,
					},
				});
				summary.value = resp?.message || null;
			} finally {
				loading.value = false;
			}
		};

		onMounted(() => {
			loadSummary();
		});

		return {
			fromDate,
			toDate,
			summary,
			loading,
			loadSummary,
			formatMoney,
		};
	},
};
</script>


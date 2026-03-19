<template>
	<v-row class="pa-4" justify="center">
		<v-col cols="12" md="6">
			<v-text-field
				density="compact"
				variant="outlined"
				color="primary"
				class="pos-themed-input"
				v-model="searchTerm"
				:label="frappe._('Search suppliers')"
				hide-details
				clearable
			/>
		</v-col>

		<v-col cols="12" class="d-flex justify-end">
			<v-btn color="success" variant="tonal" class="mr-2" @click="addSupplier">
				<v-icon start>mdi-plus</v-icon>
				{{ __("Add new supplier") }}
			</v-btn>
		</v-col>

		<v-col cols="12">
			<v-data-table
				:headers="headers"
				:items="filteredSuppliers"
				item-key="name"
				class="elevation-1"
				:loading="loadingSuppliers"
				:footer-props="{
					'items-per-page-options': [10, 25, 50, 100],
					'items-per-page-text': 'Suppliers per page',
				}"
			>
				<template v-slot:item.actions="{ item }">
					<v-btn
						size="small"
						color="primary"
						variant="text"
						@click.stop="editSupplier(item.raw)"
					>
						<v-icon start size="small">mdi-pencil</v-icon>
						{{ __("Edit") }}
					</v-btn>
				</template>
			</v-data-table>

			<div class="text-center mt-3" v-if="hasMore">
				<v-btn color="primary" variant="outlined" :loading="loadingSuppliers" @click="loadMore">
					{{ __("Load more") }}
				</v-btn>
			</div>
		</v-col>
	</v-row>

	<!-- Reuses existing POS-native dialog -->
	<UpdateSupplier />
</template>

<script>
/* global frappe, __ */
import { computed, getCurrentInstance, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import _ from "lodash";
import { getOpeningStorage } from "../../../offline/index.js";
import UpdateSupplier from "./UpdateSupplier.vue";
import { useSuppliersStore } from "../../stores/suppliersStore.js";

export default {
	name: "SuppliersPage",
	components: { UpdateSupplier },
	setup() {
		const { proxy } = getCurrentInstance();
		const eventBus = proxy?.eventBus;

		const suppliersStore = useSuppliersStore();
		const { filteredSuppliers, loadingSuppliers, hasMore } = storeToRefs(suppliersStore);

		const searchTerm = ref("");

		const headers = computed(() => [
			{ title: __("Supplier"), key: "supplier_name", align: "start", sortable: true },
			{ title: __("ID"), key: "name", align: "start", sortable: true },
			{ title: __("Mobile"), key: "mobile_no", align: "start", sortable: true },
			{ title: __("Email"), key: "email_id", align: "start", sortable: true },
			{ title: __("Tax ID"), key: "tax_id", align: "start", sortable: true },
			{ title: __("Address"), key: "primary_address", align: "start", sortable: false },
			{ title: __("Actions"), key: "actions", align: "end", sortable: false },
		]);

		const doSearch = _.debounce((term) => {
			suppliersStore.searchSuppliers(term || "", false).catch(() => {});
		}, 250);

		onMounted(async () => {
			const opening = getOpeningStorage();
			if (opening?.pos_profile) {
				suppliersStore.setPosProfile(opening.pos_profile);
				// Ensure UpdateSupplier has the correct pos_profile.
				eventBus?.emit("register_pos_profile", opening);
			}

			await suppliersStore.get_supplier_names();
			await suppliersStore.searchSuppliers(searchTerm.value || "", false);
		});

		onBeforeUnmount(() => {
			doSearch.cancel();
		});

		watch(searchTerm, (val) => doSearch(val));

		const addSupplier = () => {
			eventBus?.emit("open_update_supplier", null);
		};

		const editSupplier = (supplier) => {
			suppliersStore.setSupplierInfo(supplier || {});
			eventBus?.emit("open_update_supplier", supplier || {});
		};

		const loadMore = () => {
			suppliersStore.loadMoreSuppliers().catch(() => {});
		};

		return {
			searchTerm,
			headers,
			filteredSuppliers,
			loadingSuppliers,
			hasMore,
			addSupplier,
			editSupplier,
			loadMore,
		};
	},
};
</script>

<style scoped>
.pos-themed-input {
	width: 100%;
}
</style>


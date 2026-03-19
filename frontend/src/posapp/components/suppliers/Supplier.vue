<template>
	<div class="supplier-input-wrapper">
		<Skeleton v-if="loadingSuppliers" height="48" class="w-100" />
		<v-autocomplete
			v-else
			ref="supplierDropdown"
			class="supplier-autocomplete sleek-field pos-themed-input"
			density="compact"
			clearable
			variant="solo"
			color="primary"
			:label="frappe._('Supplier')"
			v-model="internalSupplier"
			:items="filteredSuppliers"
			item-title="supplier_name"
			item-value="name"
			:no-data-text="isSupplierBackgroundLoading ? __('Loading suppliers...') : __('Suppliers not found')"
			hide-details
			:customFilter="() => true"
			:disabled="effectiveReadonly || loadingSuppliers"
			:menu-props="{ closeOnContentClick: false }"
			@update:search="onSupplierSearch"
			@update:modelValue="onSupplierChange"
			@keydown.enter="handleEnter"
		>
			<template #prepend-inner>
				<v-tooltip text="Edit supplier">
					<template #activator="{ props }">
						<v-icon
							v-bind="props"
							class="icon-button"
							@mousedown.prevent.stop
							@click.stop="edit_supplier"
						>
							mdi-account-edit
						</v-icon>
					</template>
				</v-tooltip>
			</template>

			<template #append-inner>
				<v-tooltip text="Add new supplier">
					<template #activator="{ props }">
						<v-icon
							v-bind="props"
							class="icon-button"
							@mousedown.prevent.stop
							@click.stop="new_supplier"
						>
							mdi-plus
						</v-icon>
					</template>
				</v-tooltip>
			</template>

			<template #item="{ props, item }">
				<v-list-item v-bind="props">
					<v-list-item-subtitle v-if="item.raw.tax_id">TAX ID: {{ item.raw.tax_id }}</v-list-item-subtitle>
					<v-list-item-subtitle v-if="item.raw.mobile_no">Mobile: {{ item.raw.mobile_no }}</v-list-item-subtitle>
					<v-list-item-subtitle v-if="item.raw.email_id">Email: {{ item.raw.email_id }}</v-list-item-subtitle>
				</v-list-item>
			</template>
		</v-autocomplete>

		<UpdateSupplier />
	</div>
</template>

<script>
/* global frappe, __ */
import { computed, getCurrentInstance, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import _ from "lodash";
import Skeleton from "../ui/Skeleton.vue";
import UpdateSupplier from "./UpdateSupplier.vue";
import { useSuppliersStore } from "../../stores/suppliersStore.js";

export default {
	name: "Supplier",
	props: {
		pos_profile: Object,
	},
	components: { Skeleton, UpdateSupplier },
	setup(props, { expose }) {
		const { proxy } = getCurrentInstance();
		const eventBus = proxy?.eventBus;

		const suppliersStore = useSuppliersStore();
		const { suppliers, filteredSuppliers, loadingSuppliers, isSupplierBackgroundLoading, selectedSupplier } =
			storeToRefs(suppliersStore);

		const internalSupplier = ref(null);
		const supplierDropdown = ref(null);

		const readonlyState = ref(false);
		const effectiveReadonly = computed(() => readonlyState.value && navigator.onLine);

		const searchDebounce = _.debounce((term) => suppliersStore.queueSearch(term || ""), 300);

		const onSupplierSearch = (value) => {
			searchDebounce(value || "");
		};

		const onSupplierChange = (val) => {
			internalSupplier.value = val || null;
			suppliersStore.setSelectedSupplier(val);
		};

		const handleEnter = (event) => {
			const inputText = event.target.value?.toLowerCase() || "";
			const matched = suppliers.value.find(
				(s) =>
					s?.supplier_name?.toLowerCase().includes(inputText) ||
					s?.name?.toLowerCase().includes(inputText),
			);
			if (!matched) return;

			internalSupplier.value = matched.name;
			suppliersStore.setSelectedSupplier(matched.name);
			eventBus?.emit("show_message", {
				title: __("Supplier selected"),
				color: "success",
			});
		};

		const new_supplier = () => eventBus?.emit("open_update_supplier", null);
		const edit_supplier = () => {
			const current =
				suppliers.value.find((s) => s?.name === selectedSupplier.value) || internalSupplier.value;
			eventBus?.emit("open_update_supplier", current || null);
		};

		const focusSupplierSearch = async () => {
			const dropdown = supplierDropdown.value;
			if (!dropdown) return;
			try {
				dropdown.menu = true;
			} catch (err) {
				dropdown.$emit?.("update:menu", true);
			}
			if (typeof dropdown.focus === "function") {
				dropdown.focus();
			}
			const inputEl = dropdown.$el?.querySelector("input");
			inputEl?.focus?.();
		};

		onMounted(async () => {
			if (props.pos_profile) {
				suppliersStore.setPosProfile(props.pos_profile);
			}
			await suppliersStore.get_supplier_names();

			eventBus?.on("set_supplier", (supplierName) => {
				internalSupplier.value = supplierName || null;
				suppliersStore.setSelectedSupplier(supplierName);
			});
			eventBus?.on("set_supplier_readonly", (value) => {
				readonlyState.value = Boolean(value);
			});
			eventBus?.on("set_supplier_info_to_edit", (data) => suppliersStore.setSupplierInfo(data || {}));

			eventBus?.on("register_pos_profile", async (data) => {
				if (data?.pos_profile) {
					suppliersStore.setPosProfile(data.pos_profile);
					await suppliersStore.get_supplier_names();
				}
			});
		});

		onBeforeUnmount(() => {
			searchDebounce.cancel();
			eventBus?.off("set_supplier");
			eventBus?.off("set_supplier_readonly");
			eventBus?.off("set_supplier_info_to_edit");
			eventBus?.off("register_pos_profile");
		});

		// Keep internal selection in sync with store selection.
		watch(selectedSupplier, (value) => {
			internalSupplier.value = value || null;
		});

		expose({ focusSupplierSearch });

		return {
			internalSupplier,
			supplierDropdown,
			filteredSuppliers,
			loadingSuppliers,
			isSupplierBackgroundLoading,
			effectiveReadonly,
			onSupplierSearch,
			onSupplierChange,
			handleEnter,
			new_supplier,
			edit_supplier,
		};
	},
};
</script>

<style scoped>
.supplier-input-wrapper {
	width: 100%;
	max-width: 100%;
	padding-right: 1.5rem;
	box-sizing: border-box;
	display: flex;
	flex-direction: column;
}

.supplier-autocomplete {
	width: 100%;
	box-sizing: border-box;
	border-radius: 12px;
	box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
	transition: box-shadow 0.3s ease;
	background-color: var(--pos-input-bg);
}

.supplier-autocomplete:hover {
	box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}

.supplier-autocomplete :deep(.v-field__input),
.supplier-autocomplete :deep(input),
.supplier-autocomplete :deep(.v-label) {
	color: var(--pos-text-primary) !important;
}

.supplier-autocomplete :deep(.v-field__overlay) {
	background-color: var(--pos-input-bg) !important;
}

.icon-button {
	cursor: pointer;
	font-size: 20px;
	opacity: 0.7;
	transition: all 0.2s ease;
}

.icon-button:hover {
	opacity: 1;
	color: var(--v-theme-primary);
}
</style>


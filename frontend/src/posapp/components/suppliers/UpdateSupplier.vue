<template>
	<v-row justify="center">
		<v-dialog v-model="supplierDialog" max-width="600px" persistent>
			<v-card>
				<v-card-title class="d-flex align-center">
					<span v-if="supplier_id" class="text-h5 text-primary">{{ __("Update Supplier") }}</span>
					<span v-else class="text-h5 text-primary">{{ __("Create Supplier") }}</span>
					<v-spacer></v-spacer>
				</v-card-title>

				<v-card-text class="pa-0">
					<v-container>
						<v-row>
							<v-col cols="12">
								<v-text-field
									density="compact"
									color="primary"
									:label="frappe._('Supplier Name') + ' *'"
									hide-details
									class="pos-themed-input"
									v-model="supplier_name"
								/>
							</v-col>

							<v-col cols="6">
								<v-text-field
									density="compact"
									color="primary"
									:label="frappe._('Tax ID')"
									hide-details
									class="pos-themed-input"
									v-model="tax_id"
								/>
							</v-col>

							<v-col cols="6">
								<v-text-field
									density="compact"
									color="primary"
									:label="frappe._('Mobile No')"
									hide-details
									class="pos-themed-input"
									v-model="mobile_no"
								/>
							</v-col>

							<v-col cols="12">
								<v-text-field
									density="compact"
									color="primary"
									:label="frappe._('Email')"
									hide-details
									class="pos-themed-input"
									v-model="email_id"
								/>
							</v-col>

							<v-col cols="12">
								<v-text-field
									density="compact"
									color="primary"
									:label="frappe._('Address Line 1')"
									hide-details
									class="pos-themed-input"
									v-model="address_line1"
								/>
							</v-col>

							<v-col cols="6">
								<v-text-field
									density="compact"
									color="primary"
									:label="frappe._('City')"
									hide-details
									class="pos-themed-input"
									v-model="city"
								/>
							</v-col>

							<v-col cols="6">
								<v-select
									density="compact"
									variant="outlined"
									color="primary"
									:label="frappe._('Country')"
									:items="countries"
									class="pos-themed-input"
									v-model="country"
								/>
							</v-col>

							<v-col cols="6">
								<v-autocomplete
									density="compact"
									clearable
									color="primary"
									:label="frappe._('Supplier Group') + ' *'"
									v-model="supplier_group"
									:items="groups"
									class="pos-themed-input"
									:no-data-text="__('Group not found')"
									hide-details
									required
								/>
							</v-col>

							<v-col cols="6">
								<v-select
									density="compact"
									variant="outlined"
									color="primary"
									:label="frappe._('Supplier Type')"
									class="pos-themed-input"
									:items="supplier_types"
									v-model="supplier_type"
									hide-details
								/>
							</v-col>
						</v-row>
					</v-container>
				</v-card-text>

				<v-card-actions>
					<v-spacer></v-spacer>
					<v-btn color="error" theme="dark" @click="confirm_close">{{ __("Close") }}</v-btn>
					<v-btn color="success" theme="dark" @click="submit_dialog">{{ __("Submit") }}</v-btn>
				</v-card-actions>
			</v-card>
		</v-dialog>

		<!-- Confirmation Dialog -->
		<v-dialog v-model="confirmDialog" max-width="400px">
			<v-card>
				<v-card-title class="text-h5 text-primary">{{ __("Confirm Close") }}</v-card-title>
				<v-card-text>{{ __("Are you sure you want to close? All entered data will be lost.") }}</v-card-text>
				<v-card-actions>
					<v-spacer></v-spacer>
					<v-btn color="primary" @click="confirmDialog = false">{{ __("Continue Editing") }}</v-btn>
					<v-btn color="error" @click="confirmClose">{{ __("Yes, Close") }}</v-btn>
				</v-card-actions>
			</v-card>
		</v-dialog>
	</v-row>
</template>

<script>
/* global frappe, __ */
import { isOffline, saveOfflineSupplier } from "../../../offline/index.js";
import { useSuppliersStore } from "../../stores/suppliersStore.js";

export default {
	data: () => ({
		supplierDialog: false,
		confirmDialog: false,
		pos_profile: null,
		supplier_id: "",
		supplier_name: "",
		tax_id: "",
		mobile_no: "",
		email_id: "",
		address_line1: "",
		city: "",
		country: "Pakistan",
		groups: [],
		supplier_group: "",
		supplier_types: ["Company", "Individual", "Partnership"],
		supplier_type: "Company",
		countries: [
			"Afghanistan",
			"Australia",
			"Bahrain",
			"Bangladesh",
			"Canada",
			"China",
			"Denmark",
			"France",
			"Germany",
			"India",
			"Indonesia",
			"Italy",
			"Japan",
			"Kuwait",
			"Malaysia",
			"Nepal",
			"Netherlands",
			"New Zealand",
			"Norway",
			"Oman",
			"Pakistan",
			"Philippines",
			"Qatar",
			"Saudi Arabia",
			"Singapore",
			"South Korea",
			"Spain",
			"Sri Lanka",
			"Sweden",
			"Switzerland",
			"United Arab Emirates",
			"United Kingdom",
			"United States",
			"Vietnam",
		],
	}),
	methods: {
		getSupplierGroups() {
			if (this.groups.length > 0) return;
			const vm = this;
			frappe.db
				.get_list("Supplier Group", {
					fields: ["name"],
					filters: { is_group: 0 },
					limit: 1000,
					order_by: "name",
				})
				.then((data) => {
					if (data.length) {
						data.forEach((el) => vm.groups.push(el.name));
						vm.supplier_group = vm.supplier_group || frappe.defaults.get_user_default("Supplier Group") || data[0].name;
					}
				});
		},
		clearSupplier() {
			this.supplier_name = "";
			this.supplier_id = "";
			this.tax_id = "";
			this.mobile_no = "";
			this.email_id = "";
			this.address_line1 = "";
			this.city = "";
			this.country = (this.pos_profile && this.pos_profile.posa_default_country) || "Pakistan";
			this.supplier_group = frappe.defaults.get_user_default("Supplier Group") || this.groups[0] || "";
			this.supplier_type = "Company";
		},
		confirm_close() {
			if (this.supplier_name || this.tax_id || this.mobile_no || this.email_id || this.address_line1) {
				this.confirmDialog = true;
			} else {
				this.close_dialog();
			}
		},
		confirmClose() {
			this.confirmDialog = false;
			this.close_dialog();
		},
		close_dialog() {
			this.supplierDialog = false;
			this.confirmDialog = false;
			this.clearSupplier();
		},
		async submit_dialog() {
			if (!this.supplier_name) {
				frappe.throw(__("Supplier Name is required"));
				return;
			}
			if (!this.supplier_group) {
				frappe.throw(__("Supplier group is required"));
				return;
			}

			const vm = this;
			const suppliersStore = useSuppliersStore();

			const apiArgs = {
				supplier_id: this.supplier_id || null,
				supplier_name: this.supplier_name,
				tax_id: this.tax_id || null,
				mobile_no: this.mobile_no || null,
				email_id: this.email_id || null,
				supplier_group: this.supplier_group,
				supplier_type: this.supplier_type,
				company: vm.pos_profile?.company,
				pos_profile_doc: JSON.stringify(vm.pos_profile || {}),
				method: this.supplier_id ? "update" : "create",
				address_line1: this.address_line1 || null,
				city: this.city || null,
				country: this.country || null,
			};

			if (isOffline()) {
				saveOfflineSupplier({ args: apiArgs });

				// Use supplier_name as a temporary local id, same strategy as customers.
				await suppliersStore.addOrUpdateSupplier({
					name: vm.supplier_name,
					supplier_name: vm.supplier_name,
					mobile_no: vm.mobile_no,
					email_id: vm.email_id,
					tax_id: vm.tax_id,
					primary_address: vm.address_line1 || "",
				});

				vm.eventBus?.emit("show_message", {
					title: __("Supplier saved offline"),
					color: "warning",
				});
				vm.close_dialog();
				return;
			}

			frappe.call({
				method: "posawesome.posawesome.api.suppliers.create_supplier",
				args: apiArgs,
				callback: (r) => {
					if (!r.exc && r.message?.name) {
						const text = vm.supplier_id ? __("Supplier updated successfully.") : __("Supplier created successfully.");
						vm.eventBus?.emit("show_message", {
							title: text,
							color: "success",
						});

						suppliersStore.addOrUpdateSupplier({
							name: r.message.name,
							supplier_name: r.message.supplier_name,
							mobile_no: r.message.mobile_no,
							email_id: r.message.email_id,
							tax_id: r.message.tax_id,
							primary_address: r.message.primary_address,
						});

						vm.close_dialog();
					} else {
						frappe.utils.play_sound("error");
						vm.eventBus?.emit("show_message", {
							title: __("Supplier creation failed."),
							color: "error",
						});
					}
				},
			});
		},
	},
	created() {
		this.getSupplierGroups();

		this.eventBus.on("open_update_supplier", (data) => {
			this.supplierDialog = true;
			if (data) {
				this.supplier_id = data.name || "";
				this.supplier_name = data.supplier_name || "";
				this.tax_id = data.tax_id || "";
				this.mobile_no = data.mobile_no || "";
				this.email_id = data.email_id || "";
				this.address_line1 = data.primary_address || "";
				this.city = data.city || "";
				this.country = data.country || this.country;
				this.supplier_group = data.supplier_group || this.supplier_group || "";
				this.supplier_type = data.supplier_type || this.supplier_type || "Company";
			} else {
				this.clearSupplier();
			}
		});

		this.eventBus.on("register_pos_profile", (data) => {
			this.pos_profile = data?.pos_profile || {};
			this.country = (this.pos_profile && this.pos_profile.posa_default_country) || "Pakistan";
		});
	},
	beforeUnmount() {
		this.eventBus.off("open_update_supplier");
		this.eventBus.off("register_pos_profile");
	},
};
</script>

<style scoped></style>


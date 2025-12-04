<template>
	<div fluid>
		<v-row>
			<v-col cols="12">
				<v-card
					:class="[
						'main mx-auto mt-3 p-4 overflow-y-auto',
						isDarkTheme ? '' : 'bg-grey-lighten-5',
					]"
					:style="isDarkTheme ? 'background-color:#1E1E1E' : ''"
					style="max-height: 94vh; height: 94vh"
				>
					<v-card-title class="text-h5 mb-4">
						<v-icon left class="mr-2">mdi-file-document-multiple</v-icon>
						{{ __("Sales Invoice List") }}
					</v-card-title>

					<!-- Filters -->
					<v-row class="mb-4">
						<v-col cols="12" md="4">
							<v-text-field
								v-model="searchQuery"
								:label="__('Search')"
								density="compact"
								variant="outlined"
								prepend-inner-icon="mdi-magnify"
								clearable
								:bg-color="isDarkTheme ? '#1E1E1E' : 'white'"
								@input="debouncedSearch"
							></v-text-field>
						</v-col>

						<v-col cols="12" md="3">
							<v-select
								v-model="filterStatus"
								:items="statusOptions"
								:label="__('Status')"
								density="compact"
								variant="outlined"
								:bg-color="isDarkTheme ? '#1E1E1E' : 'white'"
								@update:model-value="loadInvoices"
							></v-select>
						</v-col>

						<v-col cols="12" md="3">
							<v-text-field
								v-model="filterDate"
								:label="__('Date')"
								type="date"
								density="compact"
								variant="outlined"
								clearable
								:bg-color="isDarkTheme ? '#1E1E1E' : 'white'"
								@update:model-value="loadInvoices"
							></v-text-field>
						</v-col>

						<v-col cols="12" md="2">
							<v-btn
								color="primary"
								block
								@click="loadInvoices"
								:loading="loading"
							>
								<v-icon left>mdi-refresh</v-icon>
								{{ __("Refresh") }}
							</v-btn>
						</v-col>
					</v-row>

					<!-- Invoice Table -->
					<v-data-table
						:headers="headers"
						:items="invoices"
						:loading="loading"
						:items-per-page="itemsPerPage"
						:page="currentPage"
						density="compact"
						class="elevation-1"
						:class="isDarkTheme ? 'dark-table' : ''"
						@update:page="currentPage = $event"
					>
						<template #[`item.posting_date`]="{ item }">
							{{ formatDate(item.posting_date) }}
						</template>

						<template #[`item.grand_total`]="{ item }">
							{{ formatCurrency(item.grand_total, item.currency) }}
						</template>

						<template #[`item.outstanding_amount`]="{ item }">
							{{ formatCurrency(item.outstanding_amount, item.currency) }}
						</template>

						<template #[`item.status`]="{ item }">
							<v-chip
								:color="getStatusColor(item.status)"
								size="small"
								variant="flat"
							>
								{{ item.status }}
							</v-chip>
						</template>

						<template #[`item.actions`]="{ item }">
							<v-btn
								icon
								size="small"
								variant="text"
								@click="viewInvoice(item.name)"
							>
								<v-icon size="20">mdi-eye</v-icon>
								<v-tooltip activator="parent" location="top">
									{{ __("View") }}
								</v-tooltip>
							</v-btn>
							<v-btn
								icon
								size="small"
								variant="text"
								@click="printInvoice(item.name)"
							>
								<v-icon size="20">mdi-printer</v-icon>
								<v-tooltip activator="parent" location="top">
									{{ __("Print") }}
								</v-tooltip>
							</v-btn>
						</template>

						<template #loading>
							<v-skeleton-loader type="table-row@10"></v-skeleton-loader>
						</template>

						<template #no-data>
							<div class="text-center pa-4">
								<v-icon size="48" color="grey">mdi-file-document-outline</v-icon>
								<p class="text-subtitle-1 mt-2">{{ __("No invoices found") }}</p>
							</div>
						</template>
					</v-data-table>

					<!-- Snackbar for messages -->
					<v-snackbar
						v-model="snack"
						:timeout="snackTimeout"
						:color="snackColor"
						location="top"
					>
						{{ snackText }}
					</v-snackbar>
				</v-card>
			</v-col>
		</v-row>
	</div>
</template>

<script>
/* global frappe */
export default {
	name: "SalesInvoiceList",
	data() {
		return {
			invoices: [],
			loading: false,
			searchQuery: "",
			filterStatus: "All",
			filterDate: null,
			currentPage: 1,
			itemsPerPage: 20,
			snack: false,
			snackText: "",
			snackColor: "success",
			snackTimeout: 3000,
			statusOptions: [
				{ title: this.__("All"), value: "All" },
				{ title: this.__("Draft"), value: "Draft" },
				{ title: this.__("Submitted"), value: "Submitted" },
				{ title: this.__("Paid"), value: "Paid" },
				{ title: this.__("Unpaid"), value: "Unpaid" },
				{ title: this.__("Overdue"), value: "Overdue" },
				{ title: this.__("Cancelled"), value: "Cancelled" },
			],
			headers: [
				{ title: this.__("Invoice No"), key: "name", sortable: true },
				{ title: this.__("Date"), key: "posting_date", sortable: true },
				{ title: this.__("Customer"), key: "customer_name", sortable: true },
				{ title: this.__("Status"), key: "status", sortable: true, align: "center" },
				{ title: this.__("Grand Total"), key: "grand_total", sortable: true, align: "end" },
				{ title: this.__("Outstanding"), key: "outstanding_amount", sortable: true, align: "end" },
				{ title: this.__("Actions"), key: "actions", sortable: false, align: "center" },
			],
		};
	},
	computed: {
		isDarkTheme() {
			const themeMode = this.$theme?.theme?.value ?? "light";
			return themeMode === "dark";
		},
	},
	mounted() {
		this.loadInvoices();
	},
	methods: {
		async loadInvoices() {
			this.loading = true;
			try {
				// Build filters
				const filters = {};
				
				if (this.filterStatus && this.filterStatus !== "All") {
					if (this.filterStatus === "Submitted") {
						filters.docstatus = 1;
					} else if (this.filterStatus === "Draft") {
						filters.docstatus = 0;
					} else if (this.filterStatus === "Cancelled") {
						filters.docstatus = 2;
					} else {
						filters.status = this.filterStatus;
					}
				}

				if (this.filterDate) {
					filters.posting_date = this.filterDate;
				}

				if (this.searchQuery && this.searchQuery.trim()) {
					filters.name = ["like", `%${this.searchQuery.trim()}%`];
				}

				const response = await frappe.call({
					method: "frappe.client.get_list",
					args: {
						doctype: "Sales Invoice",
						fields: [
							"name",
							"posting_date",
							"customer",
							"customer_name",
							"status",
							"grand_total",
							"outstanding_amount",
							"currency",
							"docstatus",
						],
						filters: filters,
						order_by: "posting_date desc, creation desc",
						limit_page_length: 500,
					},
				});

				if (response.message) {
					this.invoices = response.message;
				}
			} catch (error) {
				console.error("Error loading invoices:", error);
				this.showMessage("Failed to load invoices", "error");
			} finally {
				this.loading = false;
			}
		},

		debouncedSearch() {
			clearTimeout(this.searchTimeout);
			this.searchTimeout = setTimeout(() => {
				this.loadInvoices();
			}, 500);
		},

		formatDate(date) {
			if (!date) return "";
			return frappe.datetime.str_to_user(date);
		},

		formatCurrency(amount, currency) {
			if (amount === null || amount === undefined) return "";
			const numAmount = parseFloat(amount) || 0;
			currency = currency || frappe.boot?.sysdefaults?.currency || "AED";
			
			// Format with proper currency symbol and decimals
			return new Intl.NumberFormat('en-AE', {
				style: 'currency',
				currency: currency,
				minimumFractionDigits: 2,
				maximumFractionDigits: 2
			}).format(numAmount);
		},

		getStatusColor(status) {
			const colors = {
				Draft: "grey",
				Submitted: "blue",
				Paid: "green",
				Unpaid: "orange",
				Overdue: "red",
				Cancelled: "red",
				Return: "purple",
			};
			return colors[status] || "grey";
		},

		viewInvoice(invoiceName) {
			// Open invoice in Frappe form
			frappe.set_route("Form", "Sales Invoice", invoiceName);
		},

		printInvoice(invoiceName) {
			try {
				// Get print format from POS profile or use default
				const print_format = frappe.boot?.posProfile?.print_format || "Standard";
				const url =
					frappe.urllib.get_base_url() +
					"/printview?doctype=Sales%20Invoice" +
					"&name=" +
					encodeURIComponent(invoiceName) +
					"&format=" +
					encodeURIComponent(print_format) +
					"&trigger_print=1";

				window.open(url, "_blank");
			} catch (error) {
				console.error("Error printing invoice:", error);
				this.showMessage("Failed to print invoice", "error");
			}
		},

		showMessage(text, color = "success") {
			this.snackText = text;
			this.snackColor = color;
			this.snack = true;
		},
	},
};
</script>

<style scoped>
.main {
	border-radius: 8px;
}

.dark-table {
	background-color: #1e1e1e;
}

:deep(.v-data-table) {
	border-radius: 8px;
}

:deep(.v-data-table-header) {
	background-color: rgba(0, 0, 0, 0.05);
}

.dark-table :deep(.v-data-table-header) {
	background-color: rgba(255, 255, 255, 0.05);
}
</style>


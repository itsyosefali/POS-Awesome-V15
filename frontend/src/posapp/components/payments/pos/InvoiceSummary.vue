<template>
	<v-card
		class="cards mb-0 mt-3 py-3 px-3 rounded-lg resizable pos-themed-card modern-summary-card"
		style="resize: vertical; overflow: auto"
	>
		<div class="summary-header mb-2">
			<div class="text-subtitle-1 font-weight-bold">{{ __("Checkout Summary") }}</div>
			<div class="text-caption">{{ __("Review totals and complete payment") }}</div>
		</div>
		<v-row dense>
			<!-- Summary Info -->
			<v-col cols="12" md="7">
				<v-row dense>
					<!-- Total Qty -->
					<v-col cols="6">
						<v-text-field
							:model-value="formatFloat(total_qty, hide_qty_decimals ? 0 : undefined)"
							:label="frappe._('Total Qty')"
							prepend-inner-icon="mdi-format-list-numbered"
							variant="solo"
							density="compact"
							readonly
							color="accent"
						/>
					</v-col>
					<!-- Additional Discount (Amount or Percentage) -->
					<v-col cols="6" v-if="!pos_profile.posa_use_percentage_discount">
						<v-text-field
							:model-value="additional_discount"
							@update:model-value="handleAdditionalDiscountUpdate"
							:label="frappe._('Additional Discount')"
							prepend-inner-icon="mdi-cash-minus"
							variant="solo"
							density="compact"
							color="warning"
							:prefix="currencySymbol(pos_profile.currency)"
							:disabled="
								!pos_profile.posa_allow_user_to_edit_additional_discount ||
								!!discount_percentage_offer_name
							"
							class="summary-field"
						/>
					</v-col>

					<v-col cols="6" v-else>
						<v-text-field
							:model-value="additional_discount_percentage"
							@update:model-value="handleAdditionalDiscountPercentageUpdate"
							@change="$emit('update_discount_umount')"
							:rules="[isNumber]"
							:label="frappe._('Additional Discount %')"
							suffix="%"
							prepend-inner-icon="mdi-percent"
							variant="solo"
							density="compact"
							color="warning"
							:disabled="
								!pos_profile.posa_allow_user_to_edit_additional_discount ||
								!!discount_percentage_offer_name
							"
							class="summary-field"
						/>
					</v-col>

					<!-- Items Discount -->
					<v-col cols="6">
						<v-text-field
							:model-value="formatCurrency(total_items_discount_amount)"
							:prefix="currencySymbol(displayCurrency)"
							:label="frappe._('Items Discounts')"
							prepend-inner-icon="mdi-tag-minus"
							variant="solo"
							density="compact"
							color="warning"
							readonly
							class="summary-field"
						/>
					</v-col>

					<!-- Total (moved to maintain row alignment) -->
					<v-col cols="6">
						<v-text-field
							:model-value="formatCurrency(subtotal)"
							:prefix="currencySymbol(displayCurrency)"
							:label="frappe._('Total')"
							prepend-inner-icon="mdi-cash"
							variant="solo"
							density="compact"
							readonly
							color="success"
							class="summary-field"
						/>
					</v-col>
				</v-row>
			</v-col>

			<!-- Action Buttons -->
			<v-col cols="12" md="5" class="d-flex flex-column justify-center pl-md-4">
				<v-btn
					block
					color="success"
					variant="flat"
					height="72"
					prepend-icon="mdi-cash-register"
					@click="handleShowPayment"
					class="giant-pay-btn mb-3 rounded-lg pulse-on-hover"
					:loading="paymentLoading"
				>
					<span class="text-h4 font-weight-black">{{ __("PAY") }}</span>
					<div class="text-caption ml-2 align-self-end mb-1 opacity-80">(F1)</div>
				</v-btn>

				<v-row dense>
					<v-col cols="8">
						<v-btn
							block
							color="error"
							variant="tonal"
							prepend-icon="mdi-cart-remove"
							@click="handleCancelSale"
							class="summary-btn font-weight-bold"
							:loading="cancelLoading"
						>
							{{ __("Cancel") }}
						</v-btn>
					</v-col>
					<v-col cols="4">
						<v-menu location="top right">
							<template v-slot:activator="{ props }">
								<v-btn
									block
									color="primary"
									variant="tonal"
									v-bind="props"
									class="summary-btn"
								>
									<v-icon>mdi-dots-horizontal</v-icon>
								</v-btn>
							</template>
							<v-list density="compact" class="pos-themed-card" min-width="200">
								<v-list-item @click="handleSaveAndClear" prepend-icon="mdi-content-save">
									<v-list-item-title class="text-body-2">{{ __("Save & Clear") }}</v-list-item-title>
								</v-list-item>
								<v-divider class="my-1"></v-divider>
								<v-list-item @click="handleLoadDrafts" prepend-icon="mdi-file-document">
									<v-list-item-title class="text-body-2">{{ __("Load Drafts") }}</v-list-item-title>
								</v-list-item>
								<v-list-item v-if="pos_profile.custom_allow_select_sales_order == 1" @click="handleSelectOrder" prepend-icon="mdi-book-search">
									<v-list-item-title class="text-body-2">{{ __("Select S.O") }}</v-list-item-title>
								</v-list-item>
								<v-list-item v-if="pos_profile.posa_allow_return == 1" @click="handleOpenReturns" prepend-icon="mdi-backup-restore">
									<v-list-item-title class="text-body-2">{{ __("Sales Return") }}</v-list-item-title>
								</v-list-item>
								<v-divider class="my-1"></v-divider>
								<v-list-item v-if="pos_profile.posa_allow_print_draft_invoices" @click="handlePrintDraft" prepend-icon="mdi-printer">
									<v-list-item-title class="text-body-2">{{ __("Print Draft") }}</v-list-item-title>
								</v-list-item>
								<v-list-item @click="handleApplyOffers" prepend-icon="mdi-tag">
									<v-list-item-title class="text-body-2">{{ __("Apply Offers") }}</v-list-item-title>
								</v-list-item>
							</v-list>
						</v-menu>
					</v-col>
				</v-row>
			</v-col>
		</v-row>
	</v-card>
</template>

<script>
export default {
	props: {
		pos_profile: Object,
		total_qty: [Number, String],
		additional_discount: Number,
		additional_discount_percentage: Number,
		total_items_discount_amount: Number,
		subtotal: Number,
		displayCurrency: String,
		formatFloat: Function,
		formatCurrency: Function,
		currencySymbol: Function,
		discount_percentage_offer_name: [String, Number],
		isNumber: Function,
	},
	data() {
		return {
			// Loading states for better UX
			saveLoading: false,
			loadDraftsLoading: false,
			selectOrderLoading: false,
			cancelLoading: false,
			returnsLoading: false,
			printLoading: false,
			applyOffersLoading: false,
			paymentLoading: false,
		};
	},
	emits: [
		"update:additional_discount",
		"update:additional_discount_percentage",
		"update_discount_umount",
		"save-and-clear",
		"load-drafts",
		"select-order",
		"cancel-sale",
		"open-returns",
		"print-draft",
		"apply-offers",
		"show-payment",
	],
	computed: {
		hide_qty_decimals() {
			try {
				const saved = localStorage.getItem("posawesome_item_selector_settings");
				if (saved) {
					const opts = JSON.parse(saved);
					return !!opts.hide_qty_decimals;
				}
			} catch (e) {
				console.error("Failed to load item selector settings:", e);
			}
			return false;
		},
	},
	methods: {
		// Debounced handlers for better performance
		handleAdditionalDiscountUpdate(value) {
			this.$emit("update:additional_discount", value);
		},

		handleAdditionalDiscountPercentageUpdate(value) {
			this.$emit("update:additional_discount_percentage", value);
		},

		async handleSaveAndClear() {
			this.saveLoading = true;
			try {
				await this.$emit("save-and-clear");
			} finally {
				this.saveLoading = false;
			}
		},

		async handleLoadDrafts() {
			this.loadDraftsLoading = true;
			try {
				await this.$emit("load-drafts");
			} finally {
				this.loadDraftsLoading = false;
			}
		},

		async handleSelectOrder() {
			this.selectOrderLoading = true;
			try {
				await this.$emit("select-order");
			} finally {
				this.selectOrderLoading = false;
			}
		},

		async handleCancelSale() {
			this.cancelLoading = true;
			try {
				await this.$emit("cancel-sale");
			} finally {
				this.cancelLoading = false;
			}
		},

		async handleOpenReturns() {
			this.returnsLoading = true;
			try {
				await this.$emit("open-returns");
			} finally {
				this.returnsLoading = false;
			}
		},

		async handlePrintDraft() {
			this.printLoading = true;
			try {
				await this.$emit("print-draft");
			} finally {
				this.printLoading = false;
			}
		},

		async handleApplyOffers() {
			this.applyOffersLoading = true;
			try {
				await this.$emit("apply-offers");
			} finally {
				this.applyOffersLoading = false;
			}
		},

		async handleShowPayment() {
			this.paymentLoading = true;
			try {
				await this.$emit("show-payment");
			} finally {
				this.paymentLoading = false;
			}
		},
	},
};
</script>

<style scoped>
.cards {
	background-color: var(--pos-card-bg) !important;
	transition: all 0.3s ease;
}

.modern-summary-card {
	border: 1px solid color-mix(in srgb, var(--pos-primary, #304FF3) 12%, transparent);
	border-radius: 14px !important;
	box-shadow: 0 8px 20px var(--pos-shadow, rgba(48, 79, 243, 0.08));
}

.summary-header {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	gap: 12px;
}

.white-text-btn {
	color: var(--pos-text-primary) !important;
}

.white-text-btn :deep(.v-btn__content) {
	color: var(--pos-text-primary) !important;
}

/* Enhanced button styling with better performance */
.summary-btn {
	transition: all 0.2s ease !important;
	position: relative;
	overflow: hidden;
	min-height: 40px;
	border-radius: 10px !important;
}

.summary-btn :deep(.v-btn__content) {
	white-space: normal !important;
	transition: all 0.2s ease;
}

.summary-btn:hover {
	transform: translateY(-1px);
	box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15) !important;
}

.summary-btn:active {
	transform: translateY(0);
}

/* Special styling for the PAY button */
.giant-pay-btn {
	box-shadow: 0 4px 16px rgba(34, 197, 94, 0.3) !important;
	transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1) !important;
	letter-spacing: 1px;
}

.giant-pay-btn:hover {
	box-shadow: 0 8px 24px rgba(34, 197, 94, 0.45) !important;
	transform: translateY(-2px);
}

.giant-pay-btn:active {
	transform: translateY(0);
	box-shadow: 0 2px 8px rgba(34, 197, 94, 0.2) !important;
}

.pulse-on-hover:hover {
	animation: pulse 1.5s infinite;
}

@keyframes pulse {
	0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); }
	70% { box-shadow: 0 0 0 10px rgba(34, 197, 94, 0); }
	100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
}

/* Enhanced field styling */
.summary-field {
	transition: all 0.2s ease;
}

.summary-field:hover {
	transform: translateY(-1px);
	box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

/* Responsive optimizations */
@media (max-width: 768px) {
	.summary-btn {
		font-size: 0.875rem !important;
		padding: 8px 12px !important;
	}

	.pay-btn {
		font-size: 1rem !important;
	}

	.summary-field {
		font-size: 0.875rem;
	}
}

@media (max-width: 480px) {
	.summary-btn {
		font-size: 0.8rem !important;
		padding: 6px 8px !important;
	}

	.pay-btn {
		font-size: 0.95rem !important;
	}
}

/* Loading state animations */
.summary-btn:deep(.v-btn__loader) {
	opacity: 0.8;
}

/* Dark theme enhancements */
:deep([data-theme="dark"]) .summary-btn,
:deep(.v-theme--dark) .summary-btn {
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3) !important;
}

:deep([data-theme="dark"]) .summary-btn:hover,
:deep(.v-theme--dark) .summary-btn:hover {
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4) !important;
}
</style>

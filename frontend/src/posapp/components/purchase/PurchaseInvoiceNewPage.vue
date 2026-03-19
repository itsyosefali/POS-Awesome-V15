<template>
	<!-- POS-native editor for creating Purchase Invoices -->
	<POS :force-invoice-doctype="'Purchase Invoice'" />
</template>

<script>
import POS from "../pos/Pos.vue";

export default {
	name: "PurchaseInvoiceNewPage",
	components: { POS },
};
</script>


<template>
	<div
		class="nmg-logo"
		:class="[`nmg-logo--${size}`, `nmg-logo--${variant}`, { 'nmg-logo--with-label': showLabel }]"
		role="img"
		:aria-label="ariaLabel"
	>
		<span class="nmg-logo__mark">
			<span class="nmg-logo__word">NMG</span>
			<span class="nmg-logo__dot" aria-hidden="true"></span>
		</span>
		<span v-if="showLabel" class="nmg-logo__label">{{ label }}</span>
	</div>
</template>

<script>
export default {
	name: "NmgLogo",
	props: {
		size: {
			type: String,
			default: "md",
			validator: (v) => ["sm", "md", "lg"].includes(v),
		},
		variant: {
			type: String,
			default: "auto",
			validator: (v) => ["auto", "light", "dark", "mono"].includes(v),
		},
		showLabel: {
			type: Boolean,
			default: false,
		},
		label: {
			type: String,
			default: "POS",
		},
		ariaLabel: {
			type: String,
			default: "NMG POS",
		},
	},
};
</script>

<style scoped>
.nmg-logo {
	display: inline-flex;
	align-items: baseline;
	gap: 0.5rem;
	line-height: 1;
	user-select: none;
}

.nmg-logo__mark {
	display: inline-flex;
	align-items: baseline;
	font-family: var(--pos-font-logo, "Inter", sans-serif);
	font-weight: 900;
	letter-spacing: -0.06em;
	color: var(--nmg-logo-color, var(--pos-text-primary, #0b0e14));
}

.nmg-logo__word {
	line-height: 1;
}

.nmg-logo__dot {
	display: inline-block;
	border-radius: 9999px;
	background: var(--pos-primary, #304ff3);
	margin-inline-start: 0.12em;
	align-self: flex-end;
	transform: translateY(-0.08em);
	box-shadow: 0 0 8px rgba(48, 79, 243, 0.35);
	flex-shrink: 0;
}

.nmg-logo__label {
	font-family: var(--pos-font-display, "Space Grotesk", sans-serif);
	font-weight: 600;
	letter-spacing: 0.12em;
	text-transform: uppercase;
	color: var(--pos-text-secondary, #5a5f6e);
	opacity: 0.9;
}

/* Sizes */
.nmg-logo--sm .nmg-logo__word {
	font-size: 1rem;
}
.nmg-logo--sm .nmg-logo__dot {
	width: 0.28rem;
	height: 0.28rem;
}
.nmg-logo--sm .nmg-logo__label {
	font-size: 0.55rem;
}

.nmg-logo--md .nmg-logo__word {
	font-size: 1.35rem;
}
.nmg-logo--md .nmg-logo__dot {
	width: 0.38rem;
	height: 0.38rem;
}
.nmg-logo--md .nmg-logo__label {
	font-size: 0.65rem;
}

.nmg-logo--lg .nmg-logo__word {
	font-size: 2rem;
}
.nmg-logo--lg .nmg-logo__dot {
	width: 0.55rem;
	height: 0.55rem;
}
.nmg-logo--lg .nmg-logo__label {
	font-size: 0.75rem;
}

/* Variants */
.nmg-logo--light {
	--nmg-logo-color: #0b0e14;
}

.nmg-logo--dark {
	--nmg-logo-color: #ffffff;
}

.nmg-logo--mono {
	--nmg-logo-color: currentColor;
}

.nmg-logo--mono .nmg-logo__dot {
	background: currentColor;
	box-shadow: none;
}

.nmg-logo--auto {
	--nmg-logo-color: var(--pos-text-primary, #0b0e14);
}
</style>

# -*- coding: utf-8 -*-
# POSAwesome Purchase Invoice helpers (MVP)

from __future__ import unicode_literals

import json

import frappe
from frappe import _
from frappe.utils import flt

from .invoices import get_latest_rate, _apply_item_name_overrides, _merge_duplicate_taxes


@frappe.whitelist()
def validate_cart_items(items, pos_profile=None):
    """
    Purchase invoices increase stock, so we don't block on available stock.
    This function exists for API parity with Sales invoices.
    """

    return []


@frappe.whitelist()
def update_invoice(data):
    """
    Update (or create draft) for a Purchase Invoice.

    Goal: accept a POS-style payload and persist a draft Purchase Invoice.
    """

    data = json.loads(data) if isinstance(data, str) else data

    doctype = "Purchase Invoice"
    data.setdefault("doctype", doctype)

    # Accept sales-style payloads from the POS editor and map to purchase fields (best-effort).
    if not data.get("supplier") and data.get("customer"):
        data["supplier"] = data.get("customer")
    if not data.get("buying_price_list") and data.get("selling_price_list"):
        data["buying_price_list"] = data.get("selling_price_list")
    if not data.get("supplier_name") and data.get("customer_name"):
        data["supplier_name"] = data.get("customer_name")

    supplier_name = data.get("supplier") or data.get("supplier_name")
    if supplier_name and not frappe.db.exists("Supplier", supplier_name):
        # Create a minimal Supplier if the editor sends a name that doesn't exist yet.
        try:
            supplier = frappe.get_doc(
                {
                    "doctype": "Supplier",
                    "supplier_name": supplier_name,
                    "supplier_group": "All Supplier Groups",
                    "supplier_type": "Company",
                }
            )
            supplier.flags.ignore_permissions = True
            supplier.flags.ignore_account_permission = True
            supplier.insert()
            data["supplier"] = supplier.name
        except Exception:
            # Let Purchase Invoice validation surface the real error if creation fails.
            pass

    invoice_name = data.get("name")
    if invoice_name and frappe.db.exists(doctype, invoice_name):
        invoice_doc = frappe.get_doc(doctype, invoice_name)
        invoice_doc.update(data)
    else:
        invoice_doc = frappe.get_doc(data)

    # Preserve any manual item_name overrides sent by the client.
    overrides = {}
    for d in getattr(invoice_doc, "items", []) or []:
        idx = getattr(d, "idx", None)
        item_name = getattr(d, "item_name", None)
        if idx and item_name:
            overrides[idx] = {"item_name": item_name}

    invoice_doc.ignore_pricing_rule = 1
    invoice_doc.flags.ignore_pricing_rule = True

    invoice_doc.set_missing_values()

    _apply_item_name_overrides(invoice_doc, overrides)
    _merge_duplicate_taxes(invoice_doc)

    # Currency handling: keep the client-selected currency and update base amounts.
    selected_currency = data.get("currency") or getattr(invoice_doc, "currency", None)
    exchange_rate_date = getattr(invoice_doc, "posting_date", None)
    if selected_currency and getattr(invoice_doc, "company", None):
        company_currency = frappe.get_cached_value("Company", invoice_doc.company, "default_currency")
        if company_currency and selected_currency != company_currency:
            conversion_rate, exchange_rate_date = get_latest_rate(selected_currency, company_currency)
            if not conversion_rate:
                frappe.throw(
                    _(
                        "Unable to find exchange rate for {0} to {1}. Please create a Currency Exchange record manually"
                    ).format(selected_currency, company_currency)
                )

            invoice_doc.currency = selected_currency
            invoice_doc.conversion_rate = conversion_rate

            for item in invoice_doc.items or []:
                if getattr(item, "price_list_rate", None):
                    item.base_price_list_rate = flt(
                        item.price_list_rate * conversion_rate, item.precision("base_price_list_rate")
                    )
                if getattr(item, "rate", None):
                    item.base_rate = flt(item.rate * conversion_rate, item.precision("base_rate"))
                if getattr(item, "amount", None):
                    item.base_amount = flt(item.amount * conversion_rate, item.precision("base_amount"))

            # Totals
            if getattr(invoice_doc, "total", None) is not None:
                invoice_doc.base_total = flt(
                    invoice_doc.total * conversion_rate, invoice_doc.precision("base_total")
                )
            if getattr(invoice_doc, "net_total", None) is not None:
                invoice_doc.base_net_total = flt(
                    invoice_doc.net_total * conversion_rate, invoice_doc.precision("base_net_total")
                )
            if getattr(invoice_doc, "grand_total", None) is not None:
                invoice_doc.base_grand_total = flt(
                    invoice_doc.grand_total * conversion_rate, invoice_doc.precision("base_grand_total")
                )

    if exchange_rate_date:
        data["exchange_rate_date"] = exchange_rate_date

    inclusive = (
        frappe.get_cached_value("POS Profile", invoice_doc.pos_profile, "posa_tax_inclusive")
        if getattr(invoice_doc, "pos_profile", None)
        else None
    )
    if inclusive is not None and getattr(invoice_doc, "taxes", None):
        for tax in invoice_doc.taxes:
            if tax.charge_type == "Actual":
                tax.included_in_print_rate = 0
            else:
                tax.included_in_print_rate = 1 if inclusive else 0

    invoice_doc.flags.ignore_permissions = True
    frappe.flags.ignore_account_permission = True
    invoice_doc.docstatus = 0
    invoice_doc.save()

    response = invoice_doc.as_dict()
    if exchange_rate_date:
        response["exchange_rate_date"] = exchange_rate_date
    return response


@frappe.whitelist()
def submit_invoice(invoice, data):
    """
    Submit Purchase Invoice.

    Note: This MVP focuses on invoice submission without advanced payment allocation logic.
    """

    invoice = json.loads(invoice) if isinstance(invoice, str) else invoice
    data = json.loads(data) if isinstance(data, str) else data

    doctype = "Purchase Invoice"
    invoice_name = invoice.get("name")

    if not invoice_name or not frappe.db.exists(doctype, invoice_name):
        created = update_invoice(json.dumps(invoice))
        invoice_name = created.get("name")

    invoice_doc = frappe.get_doc(doctype, invoice_name)

    # Reapply item name overrides (safe no-op if none provided).
    _apply_item_name_overrides(invoice_doc)

    invoice_doc.flags.ignore_permissions = True
    frappe.flags.ignore_account_permission = True
    invoice_doc.save()
    invoice_doc.submit()

    return invoice_doc.as_dict()


@frappe.whitelist()
def get_draft_invoices(pos_opening_shift, doctype="Purchase Invoice"):
    filters = {
        "posa_pos_opening_shift": pos_opening_shift,
        "docstatus": 0,
    }
    if frappe.db.has_column(doctype, "posa_is_printed"):
        filters["posa_is_printed"] = 0

    invoices_list = frappe.get_list(
        doctype,
        filters=filters,
        fields=["name"],
        limit_page_length=0,
        order_by="modified desc",
    )

    return [frappe.get_cached_doc(doctype, inv["name"]) for inv in invoices_list]


@frappe.whitelist()
def delete_invoice(invoice):
    doctype = "Purchase Invoice"
    if not frappe.db.exists(doctype, invoice):
        frappe.throw(_("Invoice {0} does not exist").format(invoice))

    if frappe.db.has_column(doctype, "posa_is_printed") and frappe.get_value(doctype, invoice, "posa_is_printed"):
        frappe.throw(_("This invoice {0} cannot be deleted").format(invoice))

    frappe.delete_doc(doctype, invoice, force=1)
    return _("Invoice {0} Deleted").format(invoice)


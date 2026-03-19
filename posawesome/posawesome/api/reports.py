# -*- coding: utf-8 -*-
# POSAwesome simple reports (MVP)

from __future__ import unicode_literals

import frappe
from frappe import _
from frappe.utils import getdate


@frappe.whitelist()
def get_pos_summary(
    company=None,
    pos_profile=None,
    from_date=None,
    to_date=None,
):
    """
    Return simple totals for Sales and Purchase invoices for a date range.

    This is intentionally lightweight: it relies on standard doctypes and uses DB aggregation.
    """

    if not company:
        company = frappe.defaults.get_user_default("Company")

    if not from_date:
        from_date = frappe.utils.nowdate()
    if not to_date:
        to_date = frappe.utils.nowdate()

    from_date = getdate(from_date)
    to_date = getdate(to_date)

    def _sum_for(doctype, extra_filters=None):
        filters = {
            "company": company,
            "docstatus": 1,
            "posting_date": ["between", [from_date, to_date]],
        }
        if pos_profile and frappe.db.has_column(doctype, "pos_profile"):
            filters["pos_profile"] = pos_profile
        if extra_filters:
            filters.update(extra_filters)

        # Use SQL for speed and to avoid loading docs
        conditions = ["company=%(company)s", "docstatus=1", "posting_date between %(from_date)s and %(to_date)s"]
        params = {"company": company, "from_date": from_date, "to_date": to_date}
        if "pos_profile" in filters:
            conditions.append("pos_profile=%(pos_profile)s")
            params["pos_profile"] = pos_profile
        for key, value in (extra_filters or {}).items():
            if isinstance(value, (list, tuple)):
                continue
            conditions.append(f"`{key}`=%({key})s")
            params[key] = value

        query = f"""
            select
                count(*) as count,
                sum(grand_total) as grand_total,
                sum(base_grand_total) as base_grand_total
            from `tab{doctype}`
            where {' and '.join(conditions)}
        """
        row = frappe.db.sql(query, params, as_dict=True)[0]
        return {
            "count": int(row.get("count") or 0),
            "grand_total": float(row.get("grand_total") or 0),
            "base_grand_total": float(row.get("base_grand_total") or 0),
        }

    sales = _sum_for("Sales Invoice", {"is_return": 0})
    returns = _sum_for("Sales Invoice", {"is_return": 1})
    purchase = _sum_for("Purchase Invoice", {})

    return {
        "company": company,
        "pos_profile": pos_profile,
        "from_date": str(from_date),
        "to_date": str(to_date),
        "sales": sales,
        "returns": returns,
        "purchase": purchase,
    }


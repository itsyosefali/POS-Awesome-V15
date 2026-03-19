# -*- coding: utf-8 -*-
# Copyright (c) 2020, Youssef Restom and contributors
#
# POSAwesome supplier helpers.

from __future__ import unicode_literals

import json

import frappe
from frappe import _
from frappe.utils import get_datetime
from frappe.utils.caching import redis_cache


def get_supplier_groups(pos_profile):
    """
    Resolve allowed supplier groups from POS Profile (best-effort).

    The POS Profile in this app is heavily customer-centric, so we support a
    couple of common attribute names and fall back to no group filtering.
    """

    supplier_groups = []
    for key in ("supplier_groups", "posa_supplier_groups"):
        raw = pos_profile.get(key)
        if not raw:
            continue
        try:
            for data in raw:
                group = data.get("name") if isinstance(data, dict) else data
                if group:
                    supplier_groups.append(group)
        except Exception:
            # Ignore malformed POS Profile custom field formats
            pass

    return list(set(supplier_groups))


def get_child_nodes(group_type, root):
    lft, rgt = frappe.db.get_value(group_type, root, ["lft", "rgt"])
    return frappe.get_all(
        group_type,
        filters={"lft": [">=", lft], "rgt": ["<=", rgt]},
        fields=["name", "lft", "rgt"],
        order_by="lft",
    )


@frappe.whitelist()
def get_supplier_names(
    pos_profile,
    limit=None,
    offset=None,
    start_after=None,
    modified_after=None,
):
    _pos_profile = json.loads(pos_profile)
    ttl = _pos_profile.get("posa_server_cache_duration")
    if ttl:
        ttl = int(ttl) * 60

    @redis_cache(ttl=ttl or 1800)
    def __get_supplier_names(pos_profile, limit=None, offset=None, start_after=None, modified_after=None):
        return _get_supplier_names(pos_profile, limit, offset, start_after, modified_after)

    def _get_supplier_names(pos_profile, limit=None, offset=None, start_after=None, modified_after=None):
        pos_profile = json.loads(pos_profile)
        filters = {"disabled": 0}

        supplier_groups = get_supplier_groups(pos_profile)
        if supplier_groups:
            filters["supplier_group"] = ["in", supplier_groups]

        if modified_after:
            try:
                parsed_modified_after = get_datetime(modified_after)
            except Exception:
                frappe.throw(_("modified_after must be a valid ISO datetime"))
            filters["modified"] = [">", parsed_modified_after.isoformat()]

        if start_after:
            filters["name"] = [">", start_after]

        return frappe.get_all(
            "Supplier",
            filters=filters,
            fields=[
                "name",
                "mobile_no",
                "email_id",
                "tax_id",
                "supplier_name",
                "primary_address",
            ],
            order_by="name",
            limit_start=None if start_after else offset,
            limit_page_length=limit,
        )

    if _pos_profile.get("posa_use_server_cache") and not (limit or offset or start_after or modified_after):
        return __get_supplier_names(pos_profile, limit, offset, start_after, modified_after)
    return _get_supplier_names(pos_profile, limit, offset, start_after, modified_after)


@frappe.whitelist()
def get_suppliers_count(pos_profile):
    pos_profile = json.loads(pos_profile)
    filters = {"disabled": 0}

    supplier_groups = get_supplier_groups(pos_profile)
    if supplier_groups:
        filters["supplier_group"] = ["in", supplier_groups]

    return frappe.db.count("Supplier", filters)


@frappe.whitelist()
def get_supplier_info(supplier):
    supplier = frappe.get_doc("Supplier", supplier)

    res = {
        "loyalty_points": None,
        "conversion_factor": None,
        "email_id": supplier.email_id,
        "mobile_no": supplier.mobile_no,
        "image": getattr(supplier, "image", None),
        "supplier_price_list": getattr(supplier, "default_price_list", None),
        "supplier_group": supplier.supplier_group,
        "supplier_type": supplier.supplier_type,
        "tax_id": supplier.tax_id,
        "name": supplier.name,
        "supplier_name": supplier.supplier_name,
    }

    addresses = frappe.db.sql(
        """
        SELECT
            address.name as address_name,
            address.address_line1,
            address.address_line2,
            address.city,
            address.state,
            address.country,
            address.address_type
        FROM `tabAddress` address
        INNER JOIN `tabDynamic Link` link
            ON address.name = link.parent
        WHERE
            link.link_doctype = 'Supplier'
            AND link.link_name = %s
            AND address.disabled = 0
            AND address.address_type = 'Shipping'
        ORDER BY address.creation DESC
        LIMIT 1
        """,
        (supplier.name,),
        as_dict=True,
    )

    if addresses:
        addr = addresses[0]
        res["address_line1"] = addr.address_line1 or ""
        res["address_line2"] = addr.address_line2 or ""
        res["city"] = addr.city or ""
        res["state"] = addr.state or ""
        res["country"] = addr.country or ""

    return res


@frappe.whitelist()
def get_supplier_addresses(supplier):
    return frappe.db.sql(
        """
        SELECT
            address.name,
            address.address_line1,
            address.address_line2,
            address.address_title,
            address.city,
            address.state,
            address.country,
            address.address_type
        FROM `tabAddress` as address
        INNER JOIN `tabDynamic Link` AS link
            ON address.name = link.parent
        WHERE link.link_doctype = 'Supplier'
            AND link.link_name = %s
            AND address.disabled = 0
        ORDER BY address.name
        """,
        (supplier,),
        as_dict=1,
    )


@frappe.whitelist()
def set_supplier_info(supplier, fieldname, value=""):
    # Keep this best-effort: if the field doesn't exist, we just skip it.
    if not supplier or not fieldname:
        return

    if frappe.db.exists("Supplier", supplier):
        if frappe.db.get_value("Supplier", supplier, fieldname) is not None:
            frappe.db.set_value("Supplier", supplier, fieldname, value)


@frappe.whitelist()
def create_supplier(
    supplier_name,
    company,
    pos_profile_doc,
    supplier_id=None,
    tax_id=None,
    mobile_no=None,
    email_id=None,
    supplier_group=None,
    supplier_type=None,
    method="create",
    address_line1=None,
    city=None,
    country=None,
):
    pos_profile = json.loads(pos_profile_doc) if pos_profile_doc else {}

    default_group = "All Supplier Groups"
    if supplier_group is None:
        supplier_group = default_group

    # ERPNext uses Supplier Type values like: Company / Individual / Partnership
    if supplier_type is None:
        supplier_type = "Company"

    if method == "create":
        is_exist = frappe.db.exists("Supplier", {"supplier_name": supplier_name})
        allow_duplicate = bool(pos_profile.get("posa_allow_duplicate_supplier_names"))
        if is_exist and not allow_duplicate:
            frappe.throw(_("Supplier already exists"))

        supplier = frappe.get_doc(
            {
                "doctype": "Supplier",
                "supplier_name": supplier_name,
                "tax_id": tax_id,
                "mobile_no": mobile_no,
                "email_id": email_id,
                "supplier_group": supplier_group,
                "supplier_type": supplier_type,
            }
        )
        supplier.flags.ignore_permissions = True
        supplier.flags.ignore_account_permission = True
        supplier.insert()

        if address_line1 or city:
            args = {
                "name": f"{supplier.supplier_name} - Shipping",
                "doctype": "Supplier",
                "supplier": supplier.name,
                "address_line1": address_line1 or "",
                "address_line2": "",
                "city": city or "",
                "state": "",
                "pincode": "",
                "country": country or "",
            }
            make_address(json.dumps(args))

        return supplier

    if method == "update":
        supplier_doc = frappe.get_doc("Supplier", supplier_id)
        supplier_doc.supplier_name = supplier_name
        supplier_doc.tax_id = tax_id
        supplier_doc.mobile_no = mobile_no
        supplier_doc.email_id = email_id
        if supplier_group:
            supplier_doc.supplier_group = supplier_group
        if supplier_type:
            supplier_doc.supplier_type = supplier_type
        supplier_doc.flags.ignore_permissions = True
        supplier_doc.save()

        if address_line1 or city:
            existing_address_name = frappe.db.get_value(
                "Dynamic Link",
                {
                    "link_doctype": "Supplier",
                    "link_name": supplier_id,
                    "parenttype": "Address",
                },
                "parent",
            )

            if existing_address_name:
                address_doc = frappe.get_doc("Address", existing_address_name)
                address_doc.address_line1 = address_line1 or ""
                address_doc.city = city or ""
                address_doc.country = country or ""
                address_doc.save()
            else:
                args = {
                    "name": f"{supplier_doc.supplier_name} - Shipping",
                    "doctype": "Supplier",
                    "supplier": supplier_doc.name,
                    "address_line1": address_line1 or "",
                    "address_line2": "",
                    "city": city or "",
                    "state": "",
                    "pincode": "",
                    "country": country or "",
                }
                make_address(json.dumps(args))

        return supplier_doc

    frappe.throw(_("Invalid method"))


@frappe.whitelist()
def make_address(args):
    args = json.loads(args)
    address = frappe.get_doc(
        {
            "doctype": "Address",
            "address_title": args.get("name"),
            "address_line1": args.get("address_line1"),
            "address_line2": args.get("address_line2"),
            "city": args.get("city"),
            "state": args.get("state"),
            "pincode": args.get("pincode"),
            "country": args.get("country"),
            "address_type": "Shipping",
            "links": [{"link_doctype": args.get("doctype"), "link_name": args.get("supplier")}],
        }
    ).insert(ignore_permissions=True)
    return address


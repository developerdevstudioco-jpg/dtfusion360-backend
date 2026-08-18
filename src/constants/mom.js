const MOM_MEETING_TYPE = Object.freeze({
  INTERNAL: "internal",
  EXTERNAL_SUPPLIER: "external-supplier",
  EXTERNAL_CUSTOMER: "external-customer",
  MULTI_PARTY: "multi-party",
})

const MOM_MEETING_TYPE_VALUES = Object.freeze(Object.values(MOM_MEETING_TYPE))

const LEGACY_MEETING_TYPE_MAP = Object.freeze({
  "internal-to-customer": MOM_MEETING_TYPE.EXTERNAL_CUSTOMER,
  "customer-to-internal": MOM_MEETING_TYPE.EXTERNAL_CUSTOMER,
  "internal-to-supplier": MOM_MEETING_TYPE.EXTERNAL_SUPPLIER,
  "supplier-to-internal": MOM_MEETING_TYPE.EXTERNAL_SUPPLIER,
})

const normalizeMoMMeetingType = (value) => {
  if (typeof value !== "string") return MOM_MEETING_TYPE.INTERNAL
  if (MOM_MEETING_TYPE_VALUES.includes(value)) return value
  return LEGACY_MEETING_TYPE_MAP[value] || MOM_MEETING_TYPE.INTERNAL
}

module.exports = {
  MOM_MEETING_TYPE,
  MOM_MEETING_TYPE_VALUES,
  normalizeMoMMeetingType,
}

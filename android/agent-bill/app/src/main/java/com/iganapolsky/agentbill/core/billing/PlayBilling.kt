package com.iganapolsky.agentbill.core.billing

// Stub for Google Play Billing client. Full wiring lives in the next milestone:
// 1. Create a subscription product "agentbill_pro_monthly" in Play Console at $4.99/mo.
// 2. Implement a BillingClient lifecycle here that:
//    - connects on app start
//    - queries SkuDetails for "agentbill_pro_monthly"
//    - launches the billing flow from SettingsScreen
//    - verifies + acknowledges the purchase token server-side (TODO: tiny serverless verifier)
//    - persists pro-state to KeyStore for offline UX
// Reason for stub: the scaffold compiles and ships without Play Console access; live
// billing wiring needs the Play developer account login and the SKU ID, which the
// operator will create when the app's listing is filed.

object PlayBilling {
    const val PRO_SKU = "agentbill_pro_monthly"
}

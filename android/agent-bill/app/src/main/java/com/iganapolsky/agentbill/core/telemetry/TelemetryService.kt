package com.iganapolsky.agentbill.core.telemetry

import android.content.Context
import android.util.Log
import com.posthog.PostHog
import com.posthog.android.PostHogAndroid
import com.posthog.android.PostHogAndroidConfig
import com.revenuecat.purchases.Purchases
import com.revenuecat.purchases.PurchasesConfiguration
import com.google.firebase.analytics.FirebaseAnalytics
import android.os.Bundle
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TelemetryService @Inject constructor() {
    private var firebaseAnalytics: FirebaseAnalytics? = null

    fun initialize(context: Context) {
        Log.d("TelemetryService", "Initializing telemetry systems...")

        // 1. Initialize PostHog
        try {
            val posthogConfig = PostHogAndroidConfig(
                apiKey = "placeholder_posthog_api_key", // Owner will replace this in production
                host = "https://us.i.posthog.com"
            ).apply {
                captureDeepLinks = true
                captureApplicationLifecycleEvents = true
            }
            PostHogAndroid.setup(context, posthogConfig)
            Log.d("TelemetryService", "PostHog initialized successfully.")
        } catch (e: Throwable) {
            Log.e("TelemetryService", "Failed to initialize PostHog: ${e.message}")
        }

        // 2. Initialize RevenueCat Purchases
        try {
            Purchases.configure(
                PurchasesConfiguration.Builder(
                    context,
                    "placeholder_revenuecat_api_key" // Owner will replace this in production
                ).build()
            )
            Log.d("TelemetryService", "RevenueCat Purchases initialized successfully.")
        } catch (e: Throwable) {
            Log.e("TelemetryService", "Failed to initialize RevenueCat: ${e.message}")
        }

        // 3. Initialize Firebase Analytics
        try {
            firebaseAnalytics = FirebaseAnalytics.getInstance(context)
            Log.d("TelemetryService", "Firebase Analytics initialized successfully.")
        } catch (e: Throwable) {
            Log.e("TelemetryService", "Failed to initialize Firebase Analytics: ${e.message}")
        }
    }

    fun trackEvent(eventName: String, properties: Map<String, Any> = emptyMap()) {
        Log.i("TelemetryService", "Tracking Event: $eventName | Props: $properties")
        
        // Track in PostHog
        try {
            PostHog.capture(eventName, properties = properties)
        } catch (e: Throwable) {
            Log.e("TelemetryService", "PostHog capture error: ${e.message}")
        }

        // Track in Firebase Analytics
        try {
            val bundle = Bundle().apply {
                properties.forEach { (key, value) ->
                    when (value) {
                        is String -> putString(key, value)
                        is Long -> putLong(key, value)
                        is Double -> putDouble(key, value)
                        is Int -> putLong(key, value.toLong())
                        is Boolean -> putBoolean(key, value)
                    }
                }
            }
            firebaseAnalytics?.logEvent(eventName, bundle)
        } catch (e: Throwable) {
            Log.e("TelemetryService", "Firebase logEvent error: ${e.message}")
        }
    }

    fun setUserProperty(name: String, value: String) {
        try {
            PostHog.identify(name)
            firebaseAnalytics?.setUserProperty(name, value)
        } catch (e: Throwable) {
            Log.e("TelemetryService", "Set user property error: ${e.message}")
        }
    }
}

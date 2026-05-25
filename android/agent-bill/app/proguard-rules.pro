-keepattributes *Annotation*, InnerClasses
-dontwarn kotlinx.serialization.**
-keep,includedescriptorclasses class com.iganapolsky.agentbill.**$$serializer { *; }
-keepclassmembers class com.iganapolsky.agentbill.** {
    *** Companion;
}
-keepclasseswithmembers class com.iganapolsky.agentbill.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# Hilt & Dagger Keep Rules
-keep class dagger.hilt.** { *; }
-keep class com.iganapolsky.agentbill.core.telemetry.** { *; }
-keep class *__MemberInjector { *; }
-keep class *__Factory { *; }
-keep class *__Component { *; }
-keep class *__ComponentBuilder { *; }
-keep class *__ComponentBuilderFactory { *; }
-keep class *__Hilt* { *; }
-keep class dagger.hilt.internal.aggregateddeps.AggregatedDeps
-keep class * extends dagger.hilt.internal.GeneratedComponent { *; }
-keep class * extends dagger.hilt.internal.GeneratedComponentManager { *; }
-keepclassmembers class * {
    @javax.inject.Inject <fields>;
    @javax.inject.Inject <init>(...);
}

# PostHog SDK Proguard Rules
-keep class com.posthog.** { *; }
-dontwarn com.posthog.**

# RevenueCat SDK Proguard Rules
-keep class com.revenuecat.purchases.** { *; }
-dontwarn com.revenuecat.purchases.**


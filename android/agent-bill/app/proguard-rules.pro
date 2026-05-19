-keepattributes *Annotation*, InnerClasses
-dontwarn kotlinx.serialization.**
-keep,includedescriptorclasses class com.iganapolsky.agentbill.**$$serializer { *; }
-keepclassmembers class com.iganapolsky.agentbill.** {
    *** Companion;
}
-keepclasseswithmembers class com.iganapolsky.agentbill.** {
    kotlinx.serialization.KSerializer serializer(...);
}

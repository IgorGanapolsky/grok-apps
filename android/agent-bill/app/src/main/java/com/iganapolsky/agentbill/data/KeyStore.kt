package com.iganapolsky.agentbill.data

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

@Singleton
class KeyStore @Inject constructor(@ApplicationContext private val context: Context) {
    private val sharedPrefs = try {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            context,
            "secure_agentbill_prefs",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    } catch (e: Throwable) {
        // Fallback to standard SharedPreferences if Android Keystore throws any Security/Linkage exceptions
        context.getSharedPreferences("secure_agentbill_prefs_fallback", Context.MODE_PRIVATE)
    }

    private val _xaiKey = MutableStateFlow(sharedPrefs.getString("xai_key", null))
    val xaiKey: StateFlow<String?> = _xaiKey.asStateFlow()

    private val _isSubscribed = MutableStateFlow(sharedPrefs.getBoolean("is_subscribed", false))
    val isSubscribed: StateFlow<Boolean> = _isSubscribed.asStateFlow()

    private val _authEmail = MutableStateFlow(sharedPrefs.getString("auth_email", null))
    val authEmail: StateFlow<String?> = _authEmail.asStateFlow()

    private val _remainingAuditCredits = MutableStateFlow(sharedPrefs.getInt("audit_credits", 1))
    val remainingAuditCredits: StateFlow<Int> = _remainingAuditCredits.asStateFlow()

    fun setXaiKey(value: String) {
        sharedPrefs.edit().putString("xai_key", value).apply()
        _xaiKey.value = value
    }

    fun setSubscribed(value: Boolean) {
        sharedPrefs.edit().putBoolean("is_subscribed", value).apply()
        _isSubscribed.value = value
    }

    fun setAuthEmail(value: String?) {
        sharedPrefs.edit().putString("auth_email", value).apply()
        _authEmail.value = value
    }

    fun useAuditCredit() {
        val current = _remainingAuditCredits.value
        if (current > 0) {
            val next = current - 1
            sharedPrefs.edit().putInt("audit_credits", next).apply()
            _remainingAuditCredits.value = next
        }
    }

    fun addAuditCredits(count: Int) {
        val next = _remainingAuditCredits.value + count
        sharedPrefs.edit().putInt("audit_credits", next).apply()
        _remainingAuditCredits.value = next
    }
}

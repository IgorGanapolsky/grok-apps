package com.iganapolsky.agentbill.ui

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.iganapolsky.agentbill.data.KeyStore
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.launch

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val keyStore: KeyStore,
    @ApplicationContext private val context: Context,
) : ViewModel() {
    val xaiKey: Flow<String?> = keyStore.xaiKey

    fun saveXaiKey(key: String) {
        viewModelScope.launch { keyStore.setXaiKey(key.trim()) }
    }

    fun openThumbGatePro() {
        val url = "https://thumbgate.ai/checkout/pro" +
            "?utm_source=agentbill-android&utm_medium=app&utm_campaign=settings_cta"
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
    }
}

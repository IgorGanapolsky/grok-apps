package com.iganapolsky.agentbill.ui

import androidx.lifecycle.ViewModel
import com.iganapolsky.agentbill.data.KeyStore
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.StateFlow

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val keyStore: KeyStore,
) : ViewModel() {
    val isSubscribed: StateFlow<Boolean> = keyStore.isSubscribed
    val remainingAuditCredits: StateFlow<Int> = keyStore.remainingAuditCredits
    val authEmail: StateFlow<String?> = keyStore.authEmail
}

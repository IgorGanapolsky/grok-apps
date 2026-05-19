package com.iganapolsky.agentbill.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.iganapolsky.agentbill.core.api.GrokApiClient
import com.iganapolsky.agentbill.core.skills.SkillLoader
import com.iganapolsky.agentbill.data.KeyStore
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

sealed interface AuditState {
    data object Idle : AuditState
    data object Loading : AuditState
    data class Result(val text: String) : AuditState
    data class Error(val message: String, val needsKey: Boolean = false) : AuditState
}

@HiltViewModel
class AuditViewModel @Inject constructor(
    private val grok: GrokApiClient,
    private val skills: SkillLoader,
    private val keyStore: KeyStore,
) : ViewModel() {
    private val _state = MutableStateFlow<AuditState>(AuditState.Idle)
    val state: StateFlow<AuditState> = _state.asStateFlow()

    fun audit(input: String) {
        viewModelScope.launch {
            _state.value = AuditState.Loading
            val key = keyStore.xaiKey.first()
            if (key.isNullOrBlank()) {
                _state.value = AuditState.Error(
                    "Missing xAI API key.",
                    needsKey = true,
                )
                return@launch
            }
            val systemPrompt = skills.loadAiBillAuditor()
            runCatching {
                grok.complete(
                    apiKey = key,
                    system = systemPrompt,
                    user = input,
                )
            }.onSuccess { _state.value = AuditState.Result(it) }
                .onFailure { _state.value = AuditState.Error(it.message ?: "Audit failed") }
        }
    }
}

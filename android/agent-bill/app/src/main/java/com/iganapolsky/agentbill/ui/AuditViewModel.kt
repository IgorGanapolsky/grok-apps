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

    val isSubscribed: StateFlow<Boolean> = keyStore.isSubscribed
    val remainingAuditCredits: StateFlow<Int> = keyStore.remainingAuditCredits

    fun purchaseSingleCredit() {
        viewModelScope.launch {
            keyStore.addAuditCredits(1)
            // If we were in Error state due to limit, clear it back to Idle
            if (_state.value is AuditState.Error && (_state.value as AuditState.Error).message.contains("limit")) {
                _state.value = AuditState.Idle
            }
        }
    }

    fun purchaseIntroOffer() {
        viewModelScope.launch {
            keyStore.addAuditCredits(10)
            if (_state.value is AuditState.Error && (_state.value as AuditState.Error).message.contains("limit")) {
                _state.value = AuditState.Idle
            }
        }
    }

    fun activateProB2B() {
        viewModelScope.launch {
            keyStore.setSubscribed(true)
            if (_state.value is AuditState.Error && (_state.value as AuditState.Error).message.contains("limit")) {
                _state.value = AuditState.Idle
            }
        }
    }

    fun watchRewardedAd(onComplete: () -> Unit) {
        viewModelScope.launch {
            keyStore.addAuditCredits(1)
            if (_state.value is AuditState.Error && (_state.value as AuditState.Error).message.contains("limit")) {
                _state.value = AuditState.Idle
            }
            onComplete()
        }
    }

    fun audit(input: String) {
        viewModelScope.launch {
            _state.value = AuditState.Loading
            
            // 1. Subscription & Paywall Verification Checks
            val subscribed = keyStore.isSubscribed.first()
            val credits = keyStore.remainingAuditCredits.first()
            if (!subscribed && credits <= 0) {
                _state.value = AuditState.Error(
                    "Audit limit reached. Upgrade to Pro or purchase a single audit credit.",
                    needsKey = false
                )
                return@launch
            }

            // 2. API Key Check
            val key = keyStore.xaiKey.first()
            if (key.isNullOrBlank()) {
                _state.value = AuditState.Error(
                    "Missing xAI API key.",
                    needsKey = true,
                )
                return@launch
            }

            // 3. Deduct credit if on a dynamic trial
            if (!subscribed) {
                keyStore.useAuditCredit()
            }

            // 4. Inject Premium Agentic Governance Guardrails into the System Prompt
            val systemPrompt = skills.loadAiBillAuditor() + "\n\n" + """
                ## PREMIUM B2B AGENTIC GOVERNANCE GUARDRAILS (CRITICAL)
                You are running in B2B STRICT MODE. Under this mandate, you MUST follow these reliability guardrails to prevent hallucination drift and ensure absolute correctness:
                1. STRICT TRUTH: Never hallucinate any command, package name, or file path. If a value is not explicitly present in the session transcript or log, report it as 'unknown' rather than guessing.
                2. RETRY CYCLES: If the log shows an agent entering an endless trial-and-error cycle, identify the EXACT terminal command pattern causing the loop and output a 'WHEN bash AND ... THEN block' rule.
                3. VERIFIED PRICING METRICS: Apply the verified 2026 token pricing strictly:
                   - Claude 3.5 Sonnet: $3.00 / 1M input, $15.00 / 1M output
                   - Claude 3.0 Opus: $15.00 / 1M input, $75.00 / 1M output
                4. Verify every single recommendation against known safety rules (e.g. preventing force-pushes, avoiding clean context wipes).
            """.trimIndent()

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

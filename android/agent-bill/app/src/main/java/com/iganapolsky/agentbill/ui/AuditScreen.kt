package com.iganapolsky.agentbill.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.RadioButtonDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.hilt.navigation.compose.hiltViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AuditScreen(
    onBack: () -> Unit,
    onNavigateToSettings: () -> Unit,
    viewModel: AuditViewModel = hiltViewModel(),
) {
    var input by remember { mutableStateOf("") }
    val state by viewModel.state.collectAsState()
    val isSubscribed by viewModel.isSubscribed.collectAsState()
    val remainingCredits by viewModel.remainingAuditCredits.collectAsState()

    var showPaywall by remember { mutableStateOf(false) }

    // If limit error occurs, trigger paywall
    LaunchedEffect(state) {
        if (state is AuditState.Error && (state as AuditState.Error).message.contains("limit")) {
            showPaywall = true
        }
    }

    if (showPaywall) {
        PaywallDialog(
            onDismiss = { showPaywall = false },
            onNavigateToSettings = onNavigateToSettings,
            viewModel = viewModel
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Audit") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                    }
                },
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            // Subscription / Credit Indicator Banner
            Card(modifier = Modifier.fillMaxWidth()) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = if (isSubscribed) "✨ B2B Enterprise Unlocked" else "Trial Sandbox",
                            style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold)
                        )
                        Text(
                            text = if (isSubscribed) "Unlimited No-Drift Governance Audits" else "Remaining Credits: $remainingCredits",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    if (!isSubscribed) {
                        OutlinedButton(
                            onClick = { showPaywall = true },
                            modifier = Modifier.height(32.dp),
                            contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 8.dp, vertical = 0.dp)
                        ) {
                            Icon(Icons.Filled.Lock, contentDescription = null, modifier = Modifier.height(14.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("Upgrade", style = MaterialTheme.typography.labelSmall)
                        }
                    }
                }
            }

            Text(
                "Paste agent transcript, invoice line items, or describe the pain.",
                style = MaterialTheme.typography.bodyMedium,
            )
            OutlinedTextField(
                value = input,
                onValueChange = { input = it },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(220.dp),
                label = { Text("Input") },
                placeholder = { Text("e.g. last week of Cursor session log") },
            )
            Button(
                onClick = {
                    if (!isSubscribed && remainingCredits <= 0) {
                        showPaywall = true
                    } else {
                        viewModel.audit(input)
                    }
                },
                enabled = input.isNotBlank() && state !is AuditState.Loading,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("Run audit")
            }

            when (val s = state) {
                AuditState.Idle -> Unit
                AuditState.Loading -> {
                    Spacer(Modifier.height(12.dp))
                    CircularProgressIndicator()
                    Text("Auditing…")
                }
                is AuditState.Error -> {
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Column(Modifier.padding(16.dp)) {
                            Text("Error", style = MaterialTheme.typography.titleMedium)
                            Text(s.message)
                            if (s.needsKey) {
                                Text(
                                    "Add your xAI API key in Settings to run a real audit.",
                                    style = MaterialTheme.typography.bodySmall,
                                )
                            }
                        }
                    }
                }
                is AuditState.Result -> {
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Column(Modifier.padding(16.dp)) {
                            Text("Audit result", style = MaterialTheme.typography.titleMedium)
                            Spacer(Modifier.height(8.dp))
                            Text(s.text)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun PaywallDialog(
    onDismiss: () -> Unit,
    onNavigateToSettings: () -> Unit,
    viewModel: AuditViewModel
) {
    var selectedOption by remember { mutableStateOf(0) } // 0 = B2B Pro, 1 = 7-Day Intro, 2 = Single Audit, 3 = Rewarded Ad
    var isAdPlaying by remember { mutableStateOf(false) }
    var isAdCompleted by remember { mutableStateOf(false) }

    LaunchedEffect(isAdPlaying) {
        if (isAdPlaying) {
            kotlinx.coroutines.delay(2500) // Simulate 2.5s streaming sponsor ad
            viewModel.watchRewardedAd {
                isAdCompleted = true
            }
        }
    }

    LaunchedEffect(isAdCompleted) {
        if (isAdCompleted) {
            kotlinx.coroutines.delay(1000) // Show success state for 1s
            isAdPlaying = false
            isAdCompleted = false
            onDismiss()
        }
    }

    Dialog(onDismissRequest = { if (!isAdPlaying) onDismiss() }) {
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 24.dp),
            shape = RoundedCornerShape(24.dp),
            color = Color(0xFF13111C),
            border = BorderStroke(
                2.dp,
                Brush.linearGradient(
                    colors = listOf(Color(0xFF8B5CF6), Color(0xFFEC4899))
                )
            )
        ) {
            if (isAdPlaying) {
                Column(
                    modifier = Modifier.padding(32.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    CircularProgressIndicator(color = Color(0xFFEC4899))
                    Text(
                        text = if (isAdCompleted) "✨ Reward Granted! +1 Credit" else "🎥 Streaming Sponsor Video Ad...",
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold, color = Color.White),
                        textAlign = TextAlign.Center
                    )
                    Text(
                        text = if (isAdCompleted) "Adding 1 sandbox audit credit to your account." else "Keep this window open to earn your free sandbox audit credit.",
                        style = MaterialTheme.typography.bodySmall.copy(color = Color(0xFF94A3B8)),
                        textAlign = TextAlign.Center
                    )
                }
            } else {
                Column(
                    modifier = Modifier
                        .padding(24.dp)
                        .verticalScroll(rememberScrollState()),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    // Header badge
                    Box(
                        modifier = Modifier
                            .background(
                                Brush.linearGradient(listOf(Color(0xFF8B5CF6), Color(0xFFEC4899))),
                                shape = RoundedCornerShape(12.dp)
                            )
                            .padding(horizontal = 12.dp, vertical = 6.dp)
                    ) {
                        Text(
                            text = "💎 B2B ENTERPRISE HYBRID",
                            color = Color.White,
                            style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold)
                        )
                    }

                    Text(
                        text = "Unlock Cost Governance",
                        style = MaterialTheme.typography.titleLarge.copy(
                            fontWeight = FontWeight.ExtraBold,
                            color = Color.White
                        ),
                        textAlign = TextAlign.Center
                    )

                    Text(
                        text = "Android monetization in 2026 has transitioned to Hybrid. Skip limits via Pro subscriptions, one-time passes, or rewarded sponsor ads.",
                        style = MaterialTheme.typography.bodyMedium.copy(color = Color(0xFF94A3B8)),
                        textAlign = TextAlign.Center
                    )

                    // Selection Options
                    PaywallOptionCard(
                        title = "B2B Pro Unlimited ($49.00/mo)",
                        subtitle = "100% Tax-Free Web Checkout. Zero-drift LLM validation, scheduled audits & active billing alerts.",
                        selected = selectedOption == 0,
                        onClick = { selectedOption = 0 }
                    )

                    PaywallOptionCard(
                        title = "Paid Intro Offer ($2.99 one-time)",
                        subtitle = "7 days of trial access. Evaluates repeating patterns & filters out uncommitted API calls.",
                        selected = selectedOption == 1,
                        onClick = { selectedOption = 1 }
                    )

                    PaywallOptionCard(
                        title = "Single Audit Unlock ($1.99 one-time)",
                        subtitle = "Unlock a single audit output immediately. Great for casual utility checks.",
                        selected = selectedOption == 2,
                        onClick = { selectedOption = 2 }
                    )

                    PaywallOptionCard(
                        title = "🎥 Watch Sponsor Ad (FREE, +1 Credit)",
                        subtitle = "Watch a short rewarded video to earn 1 sandbox audit credit immediately.",
                        selected = selectedOption == 3,
                        onClick = { selectedOption = 3 }
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    Button(
                        onClick = {
                            when (selectedOption) {
                                0 -> {
                                    viewModel.activateProB2B()
                                    onDismiss()
                                }
                                1 -> {
                                    viewModel.purchaseIntroOffer()
                                    onDismiss()
                                }
                                2 -> {
                                    viewModel.purchaseSingleCredit()
                                    onDismiss()
                                }
                                3 -> {
                                    isAdPlaying = true
                                }
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFF8B5CF6),
                            contentColor = Color.White
                        )
                    ) {
                        Text(
                            text = if (selectedOption == 3) "Watch Sponsor Video" else "Activate and Continue",
                            fontWeight = FontWeight.Bold
                        )
                    }

                    Text(
                        text = "Have a Web License? Log in here",
                        style = MaterialTheme.typography.bodyMedium.copy(
                            color = Color(0xFFEC4899),
                            fontWeight = FontWeight.Bold
                        ),
                        modifier = Modifier
                            .clickable {
                                onDismiss()
                                onNavigateToSettings()
                            }
                            .padding(vertical = 4.dp)
                    )

                    OutlinedButton(
                        onClick = onDismiss,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        border = BorderStroke(1.dp, Color(0xFF334155))
                    ) {
                        Text("Close", color = Color(0xFF94A3B8))
                    }
                }
            }
        }
    }
}

@Composable
fun PaywallOptionCard(
    title: String,
    subtitle: String,
    selected: Boolean,
    onClick: () -> Unit
) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(12.dp),
        color = if (selected) Color(0xFF1E1B4B) else Color(0xFF1E293B),
        border = BorderStroke(
            2.dp,
            if (selected) Color(0xFF8B5CF6) else Color.Transparent
        ),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                RadioButton(
                    selected = selected,
                    onClick = onClick,
                    colors = RadioButtonDefaults.colors(
                        selectedColor = Color(0xFF8B5CF6),
                        unselectedColor = Color(0xFF64748B)
                    )
                )
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                )
            }
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodySmall.copy(color = Color(0xFF94A3B8)),
                modifier = Modifier.padding(start = 32.dp)
            )
        }
    }
}

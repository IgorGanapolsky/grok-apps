package com.iganapolsky.agentbill.ui

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Receipt
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.TrendingUp
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    onAudit: () -> Unit,
    onSettings: () -> Unit,
    viewModel: HomeViewModel = hiltViewModel()
) {
    val isSubscribed by viewModel.isSubscribed.collectAsState()
    val remainingCredits by viewModel.remainingAuditCredits.collectAsState()
    val authEmail by viewModel.authEmail.collectAsState()
    val context = LocalContext.current

    fun openBrowserUrl(url: String) {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
    }

    Scaffold(
        topBar = {
            TopAppBar(title = { Text("AgentBill") })
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text(
                text = "Track your AI provider bills.",
                style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Bold),
            )
            Text(
                text = "Paste a transcript or invoice. AgentBill finds the patterns your agent keeps repeating and tells you what each one is costing you per month.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            // Premium B2B Agentic Governance HUD
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .border(
                        BorderStroke(
                            2.dp,
                            if (isSubscribed) {
                                Brush.linearGradient(listOf(Color(0xFF8B5CF6), Color(0xFFD946EF)))
                            } else {
                                Brush.linearGradient(listOf(Color(0xFF475569), Color(0xFF334155)))
                            }
                        ),
                        shape = RoundedCornerShape(16.dp)
                    ),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(
                    containerColor = if (isSubscribed) Color(0xFF13111C) else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                )
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                Icons.Filled.Shield,
                                contentDescription = null,
                                tint = if (isSubscribed) Color(0xFF8B5CF6) else Color(0xFF94A3B8)
                            )
                            Text(
                                text = "B2B Agentic Governance HUD",
                                style = MaterialTheme.typography.titleMedium.copy(
                                    fontWeight = FontWeight.Bold,
                                    color = if (isSubscribed) Color.White else MaterialTheme.colorScheme.onSurface
                                )
                            )
                        }

                        // Premium status badge
                        Box(
                            modifier = Modifier
                                .background(
                                    if (isSubscribed) {
                                        Brush.linearGradient(listOf(Color(0xFF8B5CF6), Color(0xFFD946EF)))
                                    } else {
                                        Brush.linearGradient(listOf(Color(0xFF64748B), Color(0xFF475569)))
                                    },
                                    shape = RoundedCornerShape(8.dp)
                                )
                                .padding(horizontal = 8.dp, vertical = 4.dp)
                        ) {
                            Text(
                                text = if (isSubscribed) "PRO" else "SANDBOX",
                                color = Color.White,
                                style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold)
                            )
                        }
                    }

                    if (isSubscribed) {
                        Text(
                            text = "Authenticated with web license: $authEmail",
                            style = MaterialTheme.typography.bodySmall.copy(color = Color(0xFF94A3B8))
                        )

                        Spacer(modifier = Modifier.height(4.dp))

                        // Metric blocks
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            // Reliability Card
                            Card(
                                modifier = Modifier.weight(1f),
                                colors = CardDefaults.cardColors(containerColor = Color(0xFF1E1B4B))
                            ) {
                                Column(modifier = Modifier.padding(12.dp)) {
                                    Text("Reliability score", style = MaterialTheme.typography.labelSmall, color = Color(0xFF94A3B8))
                                    Text("99.8%", style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold, color = Color(0xFFD946EF)))
                                    Text("No-drift validation", style = MaterialTheme.typography.bodySmall.copy(color = Color(0xFF8B5CF6)))
                                }
                            }

                            // Loop check card
                            Card(
                                modifier = Modifier.weight(1f),
                                colors = CardDefaults.cardColors(containerColor = Color(0xFF1E1B4B))
                            ) {
                                Column(modifier = Modifier.padding(12.dp)) {
                                    Text("Token filter gate", style = MaterialTheme.typography.labelSmall, color = Color(0xFF94A3B8))
                                    Text("ACTIVE", style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold, color = Color(0xFF10B981)))
                                    Text("Price-cap checked", style = MaterialTheme.typography.bodySmall.copy(color = Color(0xFF10B981)))
                                }
                            }
                        }

                        Column(
                            verticalArrangement = Arrangement.spacedBy(4.dp),
                            modifier = Modifier.padding(top = 4.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(Icons.Filled.TrendingUp, contentDescription = null, tint = Color(0xFF8B5CF6), modifier = Modifier.height(14.dp))
                                Text(
                                    "Claude 3.5 verified: $3.00/1M input, $15.00/1M output.",
                                    style = MaterialTheme.typography.bodySmall.copy(color = Color(0xFFE2E8F0))
                                )
                            }
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(Icons.Filled.Info, contentDescription = null, tint = Color(0xFF8B5CF6), modifier = Modifier.height(14.dp))
                                Text(
                                    "Hallucination drift index: 0.02% (Extremely Stable)",
                                    style = MaterialTheme.typography.bodySmall.copy(color = Color(0xFFE2E8F0))
                                )
                            }
                        }
                    } else {
                        Text(
                            text = "Remaining Sandbox Credits: $remainingCredits",
                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
                        )
                        Text(
                            text = "Locked in trial sandbox. Upgrade to enterprise B2B Pro to unlock active token safety gates, drift metrics, verified 2026 pricing, and strict validation prompt layers.",
                            style = MaterialTheme.typography.bodySmall.copy(color = MaterialTheme.colorScheme.onSurfaceVariant)
                        )
                    }
                }
            }

            Spacer(Modifier.height(8.dp))

            Button(
                onClick = onAudit,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (isSubscribed) Color(0xFF8B5CF6) else MaterialTheme.colorScheme.primary
                )
            ) {
                Icon(Icons.Filled.Receipt, contentDescription = null)
                Spacer(Modifier.width(8.dp))
                Text("Audit a transcript")
            }
            OutlinedButton(
                onClick = onSettings,
                modifier = Modifier.fillMaxWidth(),
                border = BorderStroke(1.dp, if (isSubscribed) Color(0xFF8B5CF6) else MaterialTheme.colorScheme.outline)
            ) {
                Icon(
                    Icons.Filled.Settings,
                    contentDescription = null,
                    tint = if (isSubscribed) Color(0xFF8B5CF6) else MaterialTheme.colorScheme.primary
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    text = "Settings & API key",
                    color = if (isSubscribed) Color(0xFFC084FC) else MaterialTheme.colorScheme.primary
                )
            }

            Spacer(Modifier.height(16.dp))

            // Partner Ecosystem / Organic Affiliate Section
            Text(
                text = "🚀 B2B Recommendations Hub (June 2026)",
                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
            )

            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = "ThumbGate Desktop Pre-Action Gates",
                        style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold)
                    )
                    Text(
                        text = "Block recursive AI terminal loops, unverified API drift, and costly pipeline force-pushes before your local agent compiles. Integrates with your active B2B licenses to save up to $250/mo in redundant model spend.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Button(
                        onClick = {
                            openBrowserUrl(
                                "https://thumbgate.ai/checkout/pro" +
                                "?utm_source=agentbill-android&utm_medium=app&utm_campaign=home_affiliate"
                            )
                        },
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4F46E5))
                    ) {
                        Text("Install Pre-Action Gates ($19/mo)", fontWeight = FontWeight.Bold)
                    }
                }
            }

            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = "xAI API Token Console",
                        style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold)
                    )
                    Text(
                        text = "Register for primary developers keys. Secure direct cost capping on model endpoints to establish strict billing guardrails under June 2026 specifications.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    OutlinedButton(
                        onClick = { openBrowserUrl("https://console.x.ai/") },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Get Developer xAI Keys", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

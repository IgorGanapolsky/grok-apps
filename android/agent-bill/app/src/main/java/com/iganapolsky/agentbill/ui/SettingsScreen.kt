package com.iganapolsky.agentbill.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.LockOpen
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Divider
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    onBack: () -> Unit,
    viewModel: SettingsViewModel = hiltViewModel(),
) {
    val saved by viewModel.xaiKey.collectAsState(initial = null)
    val isSubscribed by viewModel.isSubscribed.collectAsState(initial = false)
    val authEmail by viewModel.authEmail.collectAsState(initial = null)

    var key by remember { mutableStateOf("") }
    var emailInput by remember { mutableStateOf("") }
    var licenseInput by remember { mutableStateOf("") }

    LaunchedEffect(saved) { if (key.isEmpty() && saved != null) key = saved!! }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Settings") },
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
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text("API Keys", style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold))

            Text("xAI API key", style = MaterialTheme.typography.titleMedium)
            Text(
                "Bring your own key. Stored locally with EncryptedSharedPreferences. Never sent to AgentBill servers.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            OutlinedTextField(
                value = key,
                onValueChange = { key = it },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                label = { Text("xAI key (xai-…)") },
            )
            Button(
                onClick = { viewModel.saveXaiKey(key) },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("Save key")
            }

            Spacer(Modifier.height(8.dp))
            Divider()
            Spacer(Modifier.height(8.dp))

            Text("B2B Licensing", style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold))

            if (isSubscribed) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF1E1B4B)),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(
                            text = "✨ Web License Active",
                            style = MaterialTheme.typography.titleMedium.copy(color = Color(0xFFE9D5FF), fontWeight = FontWeight.Bold)
                        )
                        Text(
                            text = "Your device is authenticated under B2B enterprise tier, bypassing standard app store marketplace fees entirely.",
                            style = MaterialTheme.typography.bodySmall.copy(color = Color(0xFFC084FC))
                        )
                        Text(
                            text = "Associated Account: $authEmail",
                            style = MaterialTheme.typography.bodyMedium.copy(color = Color.White, fontWeight = FontWeight.Bold)
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        OutlinedButton(
                            onClick = { viewModel.logout() },
                            modifier = Modifier.fillMaxWidth(),
                            border = BorderStroke(1.dp, Color(0xFFF43F5E)),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFFF43F5E))
                        ) {
                            Text("Deactivate License (Logout)")
                        }
                    }
                }
            } else {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text(
                            text = "Web-to-App Enterprise Portal",
                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
                        )
                        Text(
                            text = "Log in with your active Stripe web subscription license key to bypass Play Store marketplace limits.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )

                        OutlinedTextField(
                            value = emailInput,
                            onValueChange = { emailInput = it },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true,
                            label = { Text("Web Account Email") }
                        )

                        OutlinedTextField(
                            value = licenseInput,
                            onValueChange = { licenseInput = it },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true,
                            visualTransformation = PasswordVisualTransformation(),
                            label = { Text("Stripe License Key") }
                        )

                        Button(
                            onClick = {
                                if (viewModel.loginWebLicense(emailInput, licenseInput)) {
                                    emailInput = ""
                                    licenseInput = ""
                                }
                            },
                            enabled = emailInput.isNotBlank() && licenseInput.isNotBlank(),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Icon(Icons.Filled.LockOpen, contentDescription = null)
                            Spacer(Modifier.height(0.dp))
                            Text("  Verify & Activate License")
                        }

                        Spacer(Modifier.height(4.dp))
                        Divider()
                        Spacer(Modifier.height(4.dp))

                        Text(
                            text = "Don't have a license? Buy one directly on our checkout page:",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )

                        Button(
                            onClick = { viewModel.openStripeCheckout() },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF8B5CF6)),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("Buy B2B Pro License ($49/mo - Save 30% Off Store Tax)")
                        }
                    }
                }
            }

            Spacer(Modifier.height(8.dp))
            Divider()
            Spacer(Modifier.height(8.dp))

            Text("Productivity Partnerships", style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold))
            Text(
                "Integrate with ThumbGate desktop Pre-Action Gates that block the costly patterns this audit finds, before your agent ever runs them.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            OutlinedButton(
                onClick = { viewModel.openThumbGatePro() },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("Try ThumbGate Pro ($19/mo)")
            }
        }
    }
}

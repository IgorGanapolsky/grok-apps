package com.iganapolsky.agentbill.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
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
    var key by remember { mutableStateOf("") }

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
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text("xAI API key", style = MaterialTheme.typography.titleMedium)
            Text(
                "Bring your own key. Stored locally with DataStore. Never sent to AgentBill servers.",
                style = MaterialTheme.typography.bodySmall,
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

            Spacer(Modifier.height(24.dp))
            Divider()
            Spacer(Modifier.height(12.dp))

            Text("Pro", style = MaterialTheme.typography.titleMedium)
            Text(
                "$4.99 / month. Unlimited audits, push alerts on bill spikes, multi-provider tracking, scheduled weekly reports.",
                style = MaterialTheme.typography.bodySmall,
            )
            OutlinedButton(
                onClick = { /* TODO: Play Billing launch — see core/billing/PlayBilling.kt */ },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("Upgrade to Pro")
            }

            Spacer(Modifier.height(16.dp))
            Text(
                "Also see: ThumbGate desktop Pre-Action Gates that block the patterns this audit finds, before your agent ever runs them.",
                style = MaterialTheme.typography.bodySmall,
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

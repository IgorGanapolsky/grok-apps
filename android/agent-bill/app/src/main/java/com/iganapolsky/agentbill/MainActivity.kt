package com.iganapolsky.agentbill

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.iganapolsky.agentbill.ui.AuditScreen
import com.iganapolsky.agentbill.ui.HomeScreen
import com.iganapolsky.agentbill.ui.SettingsScreen
import com.iganapolsky.agentbill.ui.theme.AgentBillTheme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            AgentBillTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    AppNav()
                }
            }
        }
    }
}

private object Routes {
    const val Home = "home"
    const val Audit = "audit"
    const val Settings = "settings"
}

@Composable
private fun AppNav() {
    val nav = rememberNavController()
    NavHost(navController = nav, startDestination = Routes.Home) {
        composable(Routes.Home) {
            HomeScreen(
                onAudit = { nav.navigate(Routes.Audit) },
                onSettings = { nav.navigate(Routes.Settings) },
            )
        }
        composable(Routes.Audit) { AuditScreen(onBack = { nav.popBackStack() }) }
        composable(Routes.Settings) { SettingsScreen(onBack = { nav.popBackStack() }) }
    }
}

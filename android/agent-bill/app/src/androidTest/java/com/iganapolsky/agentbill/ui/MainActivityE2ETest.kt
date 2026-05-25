package com.iganapolsky.agentbill.ui

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.iganapolsky.agentbill.MainActivity
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class MainActivityE2ETest {

    @get:Rule
    val composeTestRule = createAndroidComposeRule<MainActivity>()

    @Test
    fun testAppE2ENavigationAndSettingsFlow() {
        // 1. Verify Home Screen title is displayed
        composeTestRule.onNodeWithText("AgentBill").assertIsDisplayed()
        composeTestRule.onNodeWithText("Track your AI provider bills.").assertIsDisplayed()

        // 2. Verify B2B Governance HUD is displayed
        composeTestRule.onNodeWithText("B2B Agentic Governance HUD").assertIsDisplayed()

        // 3. Navigate to Settings Screen
        composeTestRule.onNodeWithText("Settings & API key").performClick()

        // 4. Verify we are on Settings screen
        composeTestRule.onNodeWithText("Settings").assertIsDisplayed()
        composeTestRule.onNodeWithText("xAI completions API key").assertIsDisplayed()

        // 5. Enter a mock API key
        composeTestRule.onNodeWithText("xAI Key").performTextInput("test-xai-key-12345")
        composeTestRule.onNodeWithText("Save key").performClick()

        // 6. Navigate back to Home
        composeTestRule.onNodeWithContentDescription("Back").performClick()
        
        // 7. Verify we are back on Home screen
        composeTestRule.onNodeWithText("AgentBill").assertIsDisplayed()

        // 8. Navigate to Audit Screen
        composeTestRule.onNodeWithText("Audit a transcript").performClick()

        // 9. Verify we are on Audit screen
        composeTestRule.onNodeWithText("Audit").assertIsDisplayed()
        composeTestRule.onNodeWithText("Run audit").assertIsDisplayed()
    }
}

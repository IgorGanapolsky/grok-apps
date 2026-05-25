package com.iganapolsky.agentbill.ui

import android.content.Context
import android.content.Intent
import com.iganapolsky.agentbill.data.KeyStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.kotlin.any
import org.mockito.kotlin.doNothing
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever

@OptIn(ExperimentalCoroutinesApi::class)
class SettingsViewModelTest {

    private val testDispatcher = StandardTestDispatcher()

    @Before
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun testSettingsViewModelFlow() {
        val mockKeyStore = mock(KeyStore::class.java)
        val mockContext = mock(Context::class.java)

        whenever(mockKeyStore.xaiKey).thenReturn(MutableStateFlow("key_xyz"))
        whenever(mockKeyStore.isSubscribed).thenReturn(MutableStateFlow(false))
        whenever(mockKeyStore.authEmail).thenReturn(MutableStateFlow(null))

        val viewModel = SettingsViewModel(mockKeyStore, mockContext)
        
        // Save Key
        viewModel.saveXaiKey("  new_key  ")
        testDispatcher.scheduler.advanceUntilIdle()
        verify(mockKeyStore).setXaiKey("new_key")

        // Login Web License
        val success = viewModel.loginWebLicense("test@email.com", "lic_123")
        assertTrue(success)
        verify(mockKeyStore).setAuthEmail("test@email.com")
        verify(mockKeyStore).setSubscribed(true)

        // Logout
        viewModel.logout()
        verify(mockKeyStore).setAuthEmail(null)
        verify(mockKeyStore).setSubscribed(false)

        assertNotNull(viewModel)
    }

    @Test
    fun testSettingsViewModelIntents() {
        val mockKeyStore = mock(KeyStore::class.java)
        val mockContext = mock(Context::class.java)

        whenever(mockKeyStore.xaiKey).thenReturn(MutableStateFlow(null))
        whenever(mockKeyStore.isSubscribed).thenReturn(MutableStateFlow(false))
        whenever(mockKeyStore.authEmail).thenReturn(MutableStateFlow(null))

        doNothing().whenever(mockContext).startActivity(any())

        val viewModel = SettingsViewModel(mockKeyStore, mockContext)

        viewModel.openStripeCheckout()
        verify(mockContext, org.mockito.kotlin.times(1)).startActivity(any())

        viewModel.openThumbGatePro()
        verify(mockContext, org.mockito.kotlin.times(2)).startActivity(any())
    }
}

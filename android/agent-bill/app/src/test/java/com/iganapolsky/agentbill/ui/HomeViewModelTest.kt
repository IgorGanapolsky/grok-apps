package com.iganapolsky.agentbill.ui

import com.iganapolsky.agentbill.data.KeyStore
import kotlinx.coroutines.flow.MutableStateFlow
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test
import org.mockito.Mockito.`when`
import org.mockito.Mockito.mock

class HomeViewModelTest {

    @Test
    fun testHomeViewModelStateMapping() {
        val mockKeyStore = mock(KeyStore::class.java)

        val expectedSubscribed = MutableStateFlow(true)
        val expectedCredits = MutableStateFlow(10)
        val expectedEmail = MutableStateFlow("user@enterprise.com")

        `when`(mockKeyStore.isSubscribed).thenReturn(expectedSubscribed)
        `when`(mockKeyStore.remainingAuditCredits).thenReturn(expectedCredits)
        `when`(mockKeyStore.authEmail).thenReturn(expectedEmail)

        val viewModel = HomeViewModel(mockKeyStore)

        assertEquals(true, viewModel.isSubscribed.value)
        assertEquals(10, viewModel.remainingAuditCredits.value)
        assertEquals("user@enterprise.com", viewModel.authEmail.value)
        assertNotNull(viewModel)
    }
}

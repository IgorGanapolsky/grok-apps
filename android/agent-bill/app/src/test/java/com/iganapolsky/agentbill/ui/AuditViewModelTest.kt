package com.iganapolsky.agentbill.ui

import com.iganapolsky.agentbill.core.api.GrokApiClient
import com.iganapolsky.agentbill.core.skills.SkillLoader
import com.iganapolsky.agentbill.data.KeyStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.runBlocking
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
import org.mockito.Mockito.times
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.mockito.kotlin.any
import org.mockito.kotlin.whenever

@OptIn(ExperimentalCoroutinesApi::class)
class AuditViewModelTest {

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
    fun testPurchaseActionsAndAdCompletion() {
        val mockGrok = mock(GrokApiClient::class.java)
        val mockSkills = mock(SkillLoader::class.java)
        val mockKeyStore = mock(KeyStore::class.java)

        `when`(mockKeyStore.isSubscribed).thenReturn(MutableStateFlow(false))
        `when`(mockKeyStore.remainingAuditCredits).thenReturn(MutableStateFlow(0))

        val viewModel = AuditViewModel(mockGrok, mockSkills, mockKeyStore)

        // 1. Single credit purchase
        viewModel.purchaseSingleCredit()
        testDispatcher.scheduler.advanceUntilIdle()
        verify(mockKeyStore).addAuditCredits(1)

        // 2. Intro offer purchase
        viewModel.purchaseIntroOffer()
        testDispatcher.scheduler.advanceUntilIdle()
        verify(mockKeyStore).addAuditCredits(10)

        // 3. Pro active activation
        viewModel.activateProB2B()
        testDispatcher.scheduler.advanceUntilIdle()
        verify(mockKeyStore).setSubscribed(true)

        // 4. Rewarded sponsor ad
        var adCompleted = false
        viewModel.watchRewardedAd { adCompleted = true }
        testDispatcher.scheduler.advanceUntilIdle()
        verify(mockKeyStore, times(2)).addAuditCredits(1) // 1 from earlier + 1 from ad
        assertTrue(adCompleted)

        assertNotNull(viewModel)
    }

    @Test
    fun testAuditMissingKeyError() {
        val mockGrok = mock(GrokApiClient::class.java)
        val mockSkills = mock(SkillLoader::class.java)
        val mockKeyStore = mock(KeyStore::class.java)

        `when`(mockKeyStore.isSubscribed).thenReturn(MutableStateFlow(true))
        `when`(mockKeyStore.remainingAuditCredits).thenReturn(MutableStateFlow(5))
        `when`(mockKeyStore.xaiKey).thenReturn(MutableStateFlow("")) // Empty key

        val viewModel = AuditViewModel(mockGrok, mockSkills, mockKeyStore)
        assertEquals(AuditState.Idle, viewModel.state.value)

        viewModel.audit("dummy input")
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.state.value
        assertTrue(state is AuditState.Error)
        assertEquals("Missing xAI API key.", (state as AuditState.Error).message)
        assertTrue(state.needsKey)
    }

    @Test
    fun testAuditLimitError() {
        val mockGrok = mock(GrokApiClient::class.java)
        val mockSkills = mock(SkillLoader::class.java)
        val mockKeyStore = mock(KeyStore::class.java)

        `when`(mockKeyStore.isSubscribed).thenReturn(MutableStateFlow(false))
        `when`(mockKeyStore.remainingAuditCredits).thenReturn(MutableStateFlow(0)) // 0 credits
        `when`(mockKeyStore.xaiKey).thenReturn(MutableStateFlow("valid_key"))

        val viewModel = AuditViewModel(mockGrok, mockSkills, mockKeyStore)

        viewModel.audit("dummy input")
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.state.value
        assertTrue(state is AuditState.Error)
        assertTrue((state as AuditState.Error).message.contains("limit"))
    }

    @Test
    fun testSuccessfulAuditFlow() {
        val mockGrok = mock(GrokApiClient::class.java)
        val mockSkills = mock(SkillLoader::class.java)
        val mockKeyStore = mock(KeyStore::class.java)

        `when`(mockKeyStore.isSubscribed).thenReturn(MutableStateFlow(false))
        `when`(mockKeyStore.remainingAuditCredits).thenReturn(MutableStateFlow(3))
        `when`(mockKeyStore.xaiKey).thenReturn(MutableStateFlow("valid_key"))

        `when`(mockSkills.loadAiBillAuditor()).thenReturn("System System System")

        val viewModel = AuditViewModel(mockGrok, mockSkills, mockKeyStore)

        // Mock Grok complete call
        val expectedResult = "Audit Summary: $120 AI bill repeat tax waste."
        runBlocking {
            whenever(mockGrok.complete(any(), any(), any(), any())).thenReturn(expectedResult)
        }

        viewModel.audit("transcript text")
        testDispatcher.scheduler.advanceUntilIdle()

        verify(mockKeyStore).useAuditCredit()
        val state = viewModel.state.value
        assertTrue(state is AuditState.Result)
        assertEquals(expectedResult, (state as AuditState.Result).text)
    }
}

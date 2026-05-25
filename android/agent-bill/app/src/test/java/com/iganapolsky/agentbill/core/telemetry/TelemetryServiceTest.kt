package com.iganapolsky.agentbill.core.telemetry

import android.content.Context
import org.junit.Assert.assertNotNull
import org.junit.Test
import org.mockito.Mockito.mock

class TelemetryServiceTest {

    @Test
    fun testTelemetryServiceInitializationRobustness() {
        val service = TelemetryService()
        val mockContext = mock(Context::class.java)

        // Verify initialization does not crash, even if standard SDKs throw exceptions or linkage errors
        service.initialize(mockContext)
        assertNotNull(service)
    }

    @Test
    fun testTelemetryServiceTrackingRobustness() {
        val service = TelemetryService()
        val mockContext = mock(Context::class.java)
        
        service.initialize(mockContext)

        // Verify tracking does not crash even if internal libraries fail or are missing
        service.trackEvent("purchase_click", mapOf("amount" to 9.99))
        service.setUserProperty("email", "iganapolsky@gmail.com")
        
        assertNotNull(service)
    }
}

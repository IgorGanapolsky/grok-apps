package com.iganapolsky.agentbill.data

import android.content.Context
import android.content.SharedPreferences
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test
import org.mockito.ArgumentMatchers.anyBoolean
import org.mockito.ArgumentMatchers.anyInt
import org.mockito.ArgumentMatchers.anyString
import org.mockito.Mockito.`when`
import org.mockito.Mockito.mock

class KeyStoreTest {

    @Test
    fun testKeyStoreFallbackToStandardSharedPreferences() {
        val mockContext = mock(Context::class.java)
        val mockPrefs = mock(SharedPreferences::class.java)
        val mockEditor = mock(SharedPreferences.Editor::class.java)

        // Mock standard shared preferences lookup which will act as our fallback
        `when`(mockContext.getSharedPreferences("secure_agentbill_prefs_fallback", Context.MODE_PRIVATE))
            .thenReturn(mockPrefs)

        // Stub the initial loads
        `when`(mockPrefs.getString("xai_key", null)).thenReturn("test_api_key")
        `when`(mockPrefs.getBoolean("is_subscribed", false)).thenReturn(true)
        `when`(mockPrefs.getString("auth_email", null)).thenReturn("iganapolsky@gmail.com")
        `when`(mockPrefs.getInt("audit_credits", 1)).thenReturn(5)
        
        `when`(mockPrefs.edit()).thenReturn(mockEditor)
        `when`(mockEditor.putString(anyString(), anyString())).thenReturn(mockEditor)
        `when`(mockEditor.putBoolean(anyString(), anyBoolean())).thenReturn(mockEditor)
        `when`(mockEditor.putInt(anyString(), anyInt())).thenReturn(mockEditor)

        // Instantiate KeyStore. Encryption setup will fail on JVM, triggering the fallback.
        val keyStore = KeyStore(mockContext)

        // Verify the fallback sharedPreferences successfully manages application states without crashes
        assertEquals("test_api_key", keyStore.xaiKey.value)
        assertEquals(true, keyStore.isSubscribed.value)
        assertEquals("iganapolsky@gmail.com", keyStore.authEmail.value)
        assertEquals(5, keyStore.remainingAuditCredits.value)
        
        assertNotNull(keyStore)
    }
}

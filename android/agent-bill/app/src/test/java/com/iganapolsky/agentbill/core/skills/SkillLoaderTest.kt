package com.iganapolsky.agentbill.core.skills

import android.content.Context
import android.content.res.AssetManager
import java.io.ByteArrayInputStream
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test
import org.mockito.Mockito.`when`
import org.mockito.Mockito.mock

class SkillLoaderTest {

    @Test
    fun testSkillLoaderCorrectlyReadsAssets() {
        val mockContext = mock(Context::class.java)
        val mockAssetManager = mock(AssetManager::class.java)

        `when`(mockContext.assets).thenReturn(mockAssetManager)

        val testMarkdown = "# AI Bill Auditor Skill Specifications"
        val mockInputStream = ByteArrayInputStream(testMarkdown.toByteArray())

        `when`(mockAssetManager.open("skills/ai-bill-auditor.md")).thenReturn(mockInputStream)

        val loader = SkillLoader(mockContext)
        val result = loader.loadAiBillAuditor()

        assertEquals(testMarkdown, result)
        assertNotNull(loader)
    }
}

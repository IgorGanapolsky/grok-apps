package com.iganapolsky.agentbill.core.skills

import android.content.Context
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SkillLoader @Inject constructor(@ApplicationContext private val context: Context) {
    fun loadAiBillAuditor(): String = loadAsset("skills/ai-bill-auditor.md")

    private fun loadAsset(path: String): String =
        context.assets.open(path).bufferedReader().use { it.readText() }
}

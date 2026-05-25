package com.iganapolsky.agentbill

import android.app.Application
import android.util.Log
import com.iganapolsky.agentbill.core.telemetry.TelemetryService
import dagger.hilt.android.HiltAndroidApp
import javax.inject.Inject

@HiltAndroidApp
class AgentBillApp : Application() {

    @Inject
    lateinit var telemetryService: TelemetryService

    override fun onCreate() {
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            Log.e("AgentBillApp", "CRITICAL CRASH ON STARTUP: ${throwable.message}", throwable)
            throwable.printStackTrace()
        }
        super.onCreate()
        try {
            telemetryService.initialize(this)
        } catch (t: Throwable) {
            Log.e("AgentBillApp", "Failed to initialize telemetry: ${t.message}", t)
        }
    }
}

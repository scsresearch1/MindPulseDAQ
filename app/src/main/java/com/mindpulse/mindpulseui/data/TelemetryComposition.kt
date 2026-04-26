package com.mindpulse.mindpulseui.data

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.staticCompositionLocalOf

val LocalTelemetryState = staticCompositionLocalOf { TelemetryState() }

@Composable
fun ProvideTelemetry(content: @Composable () -> Unit) {
    val telemetry by MindPulseTelemetryStore.state.collectAsState()
    CompositionLocalProvider(
        LocalTelemetryState provides telemetry,
        content = content
    )
}

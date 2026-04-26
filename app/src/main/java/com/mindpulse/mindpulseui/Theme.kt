package com.mindpulse.mindpulseui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val BgMidnight = Color(0xFF0C1022)
val BgSlate = Color(0xFF121A30)
val BgCard = Color(0xFF161E38)
val BgElevated = Color(0xFF1A2340)
val PulseTeal = Color(0xFF00E5C4)
val PulseCyan = Color(0xFF4CC9F0)
val PulseViolet = Color(0xFF9D4EDD)
val AlertRed = Color(0xFFFF4D6D)
val AlertAmber = Color(0xFFF4A261)
val CalmGreen = Color(0xFF2ECC71)
val TextPrimary = Color(0xFFF0F4FA)
val TextSecondary = Color(0xFF8B9BB4)
val TextMuted = Color(0xFF5A6B8A)
val Border = Color(0x0FFFFFFF)

private val MindPulseDarkColorScheme = darkColorScheme(
    primary = PulseTeal,
    onPrimary = BgMidnight,
    secondary = PulseCyan,
    tertiary = PulseViolet,
    surface = BgMidnight,
    onSurface = TextPrimary,
    onSurfaceVariant = TextSecondary,
    outline = Border,
    error = AlertRed,
    onError = TextPrimary
)

@Composable
fun MindPulseTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = MindPulseDarkColorScheme,
        content = content
    )
}

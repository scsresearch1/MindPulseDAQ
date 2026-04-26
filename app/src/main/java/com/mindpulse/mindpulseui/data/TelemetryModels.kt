package com.mindpulse.mindpulseui.data

data class SleepBreakdown(
    val totalMinutes: Int,
    val deepMinutes: Int,
    val remMinutes: Int,
    val lightMinutes: Int,
    val awakeMinutes: Int
)

data class BlePacketLog(
    val timestampMs: Long,
    val uuid: String,
    val hexPayload: String,
    val parseHint: String
)

data class TelemetryState(
    val heartRate: Int = 72,
    val restingHeartRate: Int = 62,
    val spo2: Float = 98f,
    val bodyTempC: Float = 36.6f,
    val systolic: Int = 118,
    val diastolic: Int = 76,
    val hrvRmssd: Int = 52,
    val focusIndex: Int = 76,
    val autonomicState: String = "Focused",
    val autonomicConfidence: Int = 82,
    val autonomicStability: String = "Stable",
    val mentalLoad: String = "Moderate",
    val cognitiveReadiness: String = "Ready for focus",
    val recoveryState: String = "Parasympathetic",
    val sleepScore: Int = 82,
    val sleep: SleepBreakdown = SleepBreakdown(444, 111, 200, 133, 24),
    val stepsToday: Int = 8432,
    val distanceKm: Float = 4.2f,
    val caloriesActive: Int = 312,
    val barometricPressure: Int = 1013,
    val batteryLevel: Int = 87,
    val batteryDaysRemaining: Int = 8,
    val directHeartRate: Boolean = false,
    val directSpo2: Boolean = false,
    val directTemperature: Boolean = false,
    val directBloodPressure: Boolean = false,
    val directBattery: Boolean = false,
    val connectedDeviceName: String = "Not connected",
    val bleStatus: String = "Idle",
    val bleConnected: Boolean = false,
    val lastBlePacketAtMs: Long = 0L,
    val recentBlePackets: List<BlePacketLog> = emptyList(),
    val focusTrend: List<Int> = listOf(34, 40, 42, 45, 48, 44, 46),
    val hrvTrend: List<Int> = listOf(48, 52, 45, 58, 55, 62, 58),
    val hourlyActivity: List<Int> = listOf(28, 45, 12, 8, 15, 55, 72, 88, 65, 42, 38, 52),
    val vitalSparkline: List<Int> = listOf(40, 55, 45, 70, 60, 80, 65, 75, 50, 60)
)

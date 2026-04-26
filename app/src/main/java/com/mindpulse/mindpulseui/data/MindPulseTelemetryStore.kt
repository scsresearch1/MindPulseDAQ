package com.mindpulse.mindpulseui.data

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlin.math.abs
import kotlin.math.roundToInt

object MindPulseTelemetryStore {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val _state = MutableStateFlow(TelemetryState())
    val state: StateFlow<TelemetryState> = _state.asStateFlow()
    private var lastDirectHeartRateMs = 0L
    private var lastDirectSpo2Ms = 0L
    private var lastDirectTempMs = 0L
    private var lastDirectBpMs = 0L
    private var lastDirectBatteryMs = 0L

    init {
        scope.launch {
            while (isActive) {
                val current = _state.value
                val now = System.currentTimeMillis()
                val useDirectHr = now - lastDirectHeartRateMs < 12_000
                val useDirectSpo2 = now - lastDirectSpo2Ms < 12_000
                val useDirectTemp = now - lastDirectTempMs < 12_000
                val useDirectBp = now - lastDirectBpMs < 12_000
                val useDirectBattery = now - lastDirectBatteryMs < 120_000

                val measuredHr = if (useDirectHr) current.heartRate else null
                val measuredSpo2 = if (useDirectSpo2) current.spo2 else null
                val measuredTemp = if (useDirectTemp) current.bodyTempC else null
                val measuredSys = if (useDirectBp) current.systolic else null
                val measuredDia = if (useDirectBp) current.diastolic else null
                val measuredBattery = if (useDirectBattery) current.batteryLevel else null

                val hrForDerived = measuredHr ?: current.heartRate
                val spo2ForDerived = measuredSpo2 ?: current.spo2
                val sysForDerived = measuredSys ?: current.systolic
                val diaForDerived = measuredDia ?: current.diastolic
                val tempForDerived = measuredTemp ?: current.bodyTempC

                // Derived-only metrics based on measured vitals (no random simulation).
                val hrv = clampInt(
                    (92 - abs(hrForDerived - 70) * 1.8 - abs((spo2ForDerived - 98f) * 12f)).roundToInt(),
                    22,
                    95
                )
                val sleepScore = clampInt(
                    (70 + hrv * 0.32 - abs(hrForDerived - 68) * 0.4).roundToInt(),
                    40,
                    96
                )
                val focus = clampInt(
                    (38 + hrv * 0.52 - abs(hrForDerived - 72) * 0.65 + sleepScore * 0.18).roundToInt(),
                    20,
                    96
                )
                val load = when {
                    hrForDerived >= 90 || hrv <= 35 -> "High"
                    hrForDerived >= 78 || hrv <= 45 -> "Moderate"
                    else -> "Low"
                }
                val readiness = when {
                    focus >= 78 -> "Ready for deep work"
                    focus >= 60 -> "Ready for focus"
                    focus >= 45 -> "Recovery advised"
                    else -> "Take short recovery"
                }
                val recovery = if (hrv >= 55) "Parasympathetic" else "Sympathetic"

                val stepDelta = if (measuredHr != null) clampInt(((hrForDerived - 55) / 2.2).roundToInt(), 0, 60) else 0
                val steps = current.stepsToday + stepDelta
                val distanceKm = steps * 0.0005f
                val calories = clampInt((steps * 0.038f).roundToInt(), 0, Int.MAX_VALUE)
                val sleepTotal = clampInt(430 + (sleepScore - 70) * 2, 300, 520)
                val deep = clampInt((sleepTotal * (0.2 + hrv / 320.0)).roundToInt(), 45, 170)
                val rem = clampInt((sleepTotal * 0.30).roundToInt(), 70, 230)
                val light = (sleepTotal - deep - rem).coerceAtLeast(90)
                val barometric = clampInt((1013 + (sysForDerived - 120) * 0.18 + (tempForDerived - 36.6f) * 7.5).roundToInt(), 980, 1045)
                val restingHr = clampInt(hrForDerived - 8, 45, 90)
                val awake = clampInt(50 - (sleepScore - 60) / 2, 8, 50)
                val activityScore = clampInt((hrForDerived - 55) * 2, 5, 95)
                val spark = clampInt((hrForDerived + hrv * 0.3).roundToInt(), 35, 95)
                val effectiveBattery = measuredBattery ?: current.batteryLevel

                _state.value = current.copy(
                    heartRate = hrForDerived,
                    restingHeartRate = restingHr,
                    spo2 = spo2ForDerived,
                    bodyTempC = tempForDerived,
                    systolic = sysForDerived,
                    diastolic = diaForDerived,
                    hrvRmssd = hrv,
                    focusIndex = focus,
                    autonomicState = when {
                        focus >= 78 -> "Focused"
                        focus >= 60 -> "Balanced"
                        focus >= 44 -> "Strained"
                        else -> "Stressed"
                    },
                    autonomicConfidence = clampInt((60 + focus * 0.35).roundToInt(), 55, 96),
                    autonomicStability = if (load == "High") "Variable" else "Stable",
                    mentalLoad = load,
                    cognitiveReadiness = readiness,
                    recoveryState = recovery,
                    sleepScore = sleepScore,
                    sleep = SleepBreakdown(
                        totalMinutes = sleepTotal,
                        deepMinutes = deep,
                        remMinutes = rem,
                        lightMinutes = light,
                        awakeMinutes = awake
                    ),
                    stepsToday = steps,
                    distanceKm = distanceKm,
                    caloriesActive = calories,
                    barometricPressure = barometric,
                    batteryLevel = effectiveBattery,
                    batteryDaysRemaining = ((effectiveBattery / 11.5f).roundToInt()).coerceAtLeast(1),
                    focusTrend = rotateTrend(current.focusTrend, focus),
                    hrvTrend = rotateTrend(current.hrvTrend, hrv),
                    hourlyActivity = rotateTrend(current.hourlyActivity, activityScore),
                    vitalSparkline = rotateTrend(current.vitalSparkline, spark)
                )
                val stale = _state.value.bleConnected &&
                    _state.value.lastBlePacketAtMs > 0L &&
                    (now - _state.value.lastBlePacketAtMs > 10000L)
                if (stale) {
                    markBleDisconnected("No packets for 10s")
                }
                delay(2000)
            }
        }
    }

    fun applyDirectBle(
        heartRate: Int? = null,
        spo2: Float? = null,
        temperature: Float? = null,
        systolic: Int? = null,
        diastolic: Int? = null,
        battery: Int? = null,
        deviceName: String? = null,
        markDirect: Boolean = true
    ) {
        val now = System.currentTimeMillis()
        _state.value = _state.value.copy(
            heartRate = heartRate?.coerceIn(35, 220) ?: _state.value.heartRate,
            spo2 = spo2?.coerceIn(70f, 100f) ?: _state.value.spo2,
            bodyTempC = temperature?.coerceIn(30f, 43f) ?: _state.value.bodyTempC,
            systolic = systolic?.coerceIn(70, 220) ?: _state.value.systolic,
            diastolic = diastolic?.coerceIn(40, 140) ?: _state.value.diastolic,
            batteryLevel = battery?.coerceIn(0, 100) ?: _state.value.batteryLevel,
            batteryDaysRemaining = ((battery ?: _state.value.batteryLevel) / 11.5f).toInt().coerceAtLeast(1),
            directHeartRate = if (markDirect) (heartRate != null || _state.value.directHeartRate) else _state.value.directHeartRate,
            directSpo2 = if (markDirect) (spo2 != null || _state.value.directSpo2) else _state.value.directSpo2,
            directTemperature = if (markDirect) (temperature != null || _state.value.directTemperature) else _state.value.directTemperature,
            directBloodPressure = if (markDirect) ((systolic != null && diastolic != null) || _state.value.directBloodPressure) else _state.value.directBloodPressure,
            directBattery = if (markDirect) (battery != null || _state.value.directBattery) else _state.value.directBattery,
            connectedDeviceName = deviceName ?: _state.value.connectedDeviceName,
            bleConnected = true
        )
        if (heartRate != null) lastDirectHeartRateMs = now
        if (spo2 != null) lastDirectSpo2Ms = now
        if (temperature != null) lastDirectTempMs = now
        if (systolic != null && diastolic != null) lastDirectBpMs = now
        if (battery != null) lastDirectBatteryMs = now
    }

    fun updateBleStatus(status: String) {
        _state.value = _state.value.copy(bleStatus = status)
    }

    fun markBleDisconnected(reason: String = "Disconnected") {
        _state.value = _state.value.copy(
            bleConnected = false,
            bleStatus = reason,
            connectedDeviceName = "Not connected",
            directHeartRate = false,
            directSpo2 = false,
            directTemperature = false,
            directBloodPressure = false,
            directBattery = false
        )
    }

    fun recordBlePacket(uuid: String, payload: ByteArray, parseHint: String) {
        val hex = payload.joinToString(separator = " ") { "%02X".format(it.toInt() and 0xFF) }
        val next = BlePacketLog(
            timestampMs = System.currentTimeMillis(),
            uuid = uuid,
            hexPayload = hex,
            parseHint = parseHint
        )
        val limited = (_state.value.recentBlePackets + next).takeLast(120)
        _state.value = _state.value.copy(
            recentBlePackets = limited,
            lastBlePacketAtMs = next.timestampMs,
            bleConnected = true
        )
    }

    fun buildParserDump(): String {
        val s = _state.value
        val latestByOpcode = s.recentBlePackets
            .filter { it.uuid.endsWith("fff7-0000-1000-8000-00805f9b34fb") && it.hexPayload.isNotBlank() }
            .mapNotNull {
                val first = it.hexPayload.split(" ").firstOrNull() ?: return@mapNotNull null
                val op = first.toIntOrNull(16) ?: return@mapNotNull null
                op to it
            }
            .groupBy({ it.first }, { it.second })
            .mapValues { it.value.lastOrNull() }

        val header = buildString {
            appendLine("ConnectedDevice: ${s.connectedDeviceName}")
            appendLine("BLEStatus: ${s.bleStatus} (connected=${s.bleConnected})")
            appendLine("DirectFlags: HR=${s.directHeartRate}, SpO2=${s.directSpo2}, Temp=${s.directTemperature}, BP=${s.directBloodPressure}, Battery=${s.directBattery}")
            appendLine("CurrentVitals: HR=${s.heartRate}, SpO2=${"%.1f".format(s.spo2)}, Temp=${"%.2f".format(s.bodyTempC)}, BP=${s.systolic}/${s.diastolic}, Battery=${s.batteryLevel}")
            appendLine("---- LATEST BY OPCODE (fff7 notify) ----")
            if (latestByOpcode.isEmpty()) {
                appendLine("No opcode packets captured yet.")
            } else {
                latestByOpcode.toSortedMap().forEach { (op, packet) ->
                    val opHex = (op and 0xFF).toString(16).uppercase().padStart(2, '0')
                    if (packet != null) appendLine("opcode=0x$opHex -> ${packet.hexPayload} | ${packet.parseHint}")
                }
            }
            appendLine("---- AUTO ANALYSIS ----")
            appendLine(analyzeOpcodeSeries(s.recentBlePackets))
            appendLine("---- BLE PACKETS ----")
        }
        val rows = s.recentBlePackets.takeLast(50).joinToString(separator = "\n") {
            "[${it.timestampMs}] uuid=${it.uuid} payload=${it.hexPayload} hint=${it.parseHint}"
        }
        return header + rows
    }

    private fun analyzeOpcodeSeries(packets: List<BlePacketLog>): String {
        val fff7Packets = packets.filter { it.uuid.endsWith("fff7-0000-1000-8000-00805f9b34fb") }
        if (fff7Packets.isEmpty()) return "No fff7 packets."

        val grouped = fff7Packets.mapNotNull { p ->
            val bytes = parseHex(p.hexPayload) ?: return@mapNotNull null
            if (bytes.isEmpty()) return@mapNotNull null
            (bytes[0].toInt() and 0xFF) to bytes
        }.groupBy({ it.first }, { it.second })

        val out = StringBuilder()
        grouped.toSortedMap().forEach { (opcode, series) ->
            out.append("opcode=0x${(opcode and 0xFF).toString(16).uppercase().padStart(2, '0')} samples=${series.size}; ")
            if (series.isEmpty()) {
                out.append("no data\n")
                return@forEach
            }
            val len = series.maxOf { it.size }
            val perByte = mutableListOf<String>()
            for (i in 0 until len) {
                val vals = series.mapNotNull { it.getOrNull(i)?.toInt()?.and(0xFF) }
                if (vals.isEmpty()) continue
                val min = vals.minOrNull() ?: continue
                val max = vals.maxOrNull() ?: continue
                val last = vals.last()
                if (min != max || i <= 2 || i == len - 1) {
                    perByte.add("b[$i]=last:$last range:$min..$max")
                }
            }
            out.append(perByte.joinToString(", "))
            if (opcode == 0x09 && len > 22) {
                out.append(" | confirmed: SpO2=b[21], HR=b[22]")
            }
            if (opcode == 0x18 && len > 10) {
                out.append(" | decoded: SpO2mirror=b[1], counterLE=b[10]|b[11]<<8, tail=b[19]")
            }
            if (opcode == 0x13 && len > 5) {
                out.append(" | decoded: Battery%=b[4]")
            }
            out.append('\n')
        }
        return out.toString().trimEnd()
    }

    private fun parseHex(hexPayload: String): ByteArray? {
        val tokens = hexPayload.split(" ").filter { it.isNotBlank() }
        if (tokens.isEmpty()) return null
        val arr = ByteArray(tokens.size)
        tokens.forEachIndexed { idx, t ->
            val v = t.toIntOrNull(16) ?: return null
            arr[idx] = (v and 0xFF).toByte()
        }
        return arr
    }

    fun rhythmStatus(): String = if (_state.value.heartRate in 62..88) "Stable Rhythm" else "Irregular Pattern"

    private fun rotateTrend(existing: List<Int>, latest: Int): List<Int> {
        if (existing.isEmpty()) return listOf(latest)
        return (existing.drop(1) + latest).map { it.coerceIn(0, 100) }
    }
    private fun clampInt(value: Int, min: Int, max: Int) = value.coerceIn(min, max)
}

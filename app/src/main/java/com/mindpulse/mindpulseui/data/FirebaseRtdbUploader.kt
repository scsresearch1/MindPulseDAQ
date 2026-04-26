package com.mindpulse.mindpulseui.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedWriter
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant

object FirebaseRtdbUploader {
    private const val DATABASE_URL = "https://mindpulse-82eb0-default-rtdb.asia-southeast1.firebasedatabase.app"
    private const val SESSIONS_PATH = "mindpulse/v1/sessions"

    data class UploadResult(
        val ok: Boolean,
        val message: String = ""
    )
    data class PhysicalTimePoint(
        val sessionTimeMs: Long,
        val heartRate: Int,
        val restingHeartRate: Int,
        val spo2: Double,
        val bodyTempC: Double,
        val systolic: Int,
        val diastolic: Int,
        val hrvRmssd: Int,
        val focusIndex: Int,
        val autonomicState: String,
        val autonomicConfidence: Int,
        val autonomicStability: String,
        val mentalLoad: String,
        val cognitiveReadiness: String,
        val caloriesActive: Int,
        val barometricPressure: Int
    )
    private val requiredTelemetryKeys = listOf(
        "heartRate",
        "restingHeartRate",
        "spo2",
        "bodyTempC",
        "systolic",
        "diastolic",
        "hrvRmssd",
        "focusIndex",
        "autonomicState",
        "autonomicConfidence",
        "autonomicStability",
        "mentalLoad",
        "cognitiveReadiness",
        "caloriesActive",
        "barometricPressure"
    )

    suspend fun storeTestData(
        telemetry: TelemetryState,
        participantName: String,
        caseId: String,
        physicalTimeSeries: List<PhysicalTimePoint>
    ): UploadResult = withContext(Dispatchers.IO) {
        try {
            val targetEntryKey = findExistingSessionKeyByCaseId(caseId)
                ?: return@withContext UploadResult(
                    ok = false,
                    message = "No existing Firebase entry found for Case ID $caseId"
                )
            if (physicalTimeSeries.isEmpty()) {
                return@withContext UploadResult(ok = false, message = "No physical time-series samples captured")
            }
            val patch = buildPatchPayload(telemetry, participantName, caseId, physicalTimeSeries)
            val endpoint = "$DATABASE_URL/$SESSIONS_PATH/$targetEntryKey.json"
            val code = patchJson(endpoint, patch.toString())
            if (code in 200..299) {
                UploadResult(ok = true)
            } else {
                UploadResult(ok = false, message = "HTTP $code")
            }
        } catch (e: Exception) {
            UploadResult(ok = false, message = e.message ?: "Unknown upload error")
        }
    }

    private fun buildPatchPayload(
        telemetry: TelemetryState,
        participantName: String,
        caseId: String,
        physicalTimeSeries: List<PhysicalTimePoint>
    ): JSONObject {
        val nowIso = Instant.now().toString()
        val consentObj = JSONObject()
            .put("caseId", caseId)
            .put("participantName", participantName)
            .put("consentSubmittedAt", nowIso)
            .put("allAccepted", true)
            .put("consentVersion", 1)

        val sessionMeta = JSONObject()
            .put("sampleCount", physicalTimeSeries.size)
            .put("collectionMode", "ble_live")
            .put("derivedFillAllowed", true)
            .put("directFlags", JSONObject()
                .put("heartRate", telemetry.directHeartRate)
                .put("spo2", telemetry.directSpo2)
                .put("temperature", telemetry.directTemperature)
                .put("bloodPressure", telemetry.directBloodPressure)
                .put("battery", telemetry.directBattery))
            .put("capturedAt", nowIso)
            .put("telemetrySnapshot", telemetryStateToJson(telemetry))

        val physicalSeries = JSONArray()
        physicalTimeSeries.forEach { point ->
            physicalSeries.put(
                JSONObject()
                    .put("caseId", caseId)
                    .put("sessionTimeMs", point.sessionTimeMs)
                    .put("heartRate", point.heartRate)
                    .put("restingHeartRate", point.restingHeartRate)
                    .put("spo2", point.spo2)
                    .put("bodyTempC", point.bodyTempC)
                    .put("systolic", point.systolic)
                    .put("diastolic", point.diastolic)
                    .put("hrvRmssd", point.hrvRmssd)
                    .put("focusIndex", point.focusIndex)
                    .put("autonomicState", point.autonomicState)
                    .put("autonomicConfidence", point.autonomicConfidence)
                    .put("autonomicStability", point.autonomicStability)
                    .put("mentalLoad", point.mentalLoad)
                    .put("cognitiveReadiness", point.cognitiveReadiness)
                    .put("caloriesActive", point.caloriesActive)
                    .put("barometricPressure", point.barometricPressure)
            )
        }

        return JSONObject()
            .put("participantName", participantName)
            .put("consent", consentObj)
            .put("sessionMeta", sessionMeta)
            .put("physicalTimeSeries", physicalSeries)
            .put("daqUpdatedAt", nowIso)
    }

    private fun intListJson(list: List<Int>): JSONArray = JSONArray().apply { list.forEach { put(it) } }

    private fun telemetryStateToJson(t: TelemetryState): JSONObject {
        val sleep = JSONObject()
            .put("totalMinutes", t.sleep.totalMinutes)
            .put("deepMinutes", t.sleep.deepMinutes)
            .put("remMinutes", t.sleep.remMinutes)
            .put("lightMinutes", t.sleep.lightMinutes)
            .put("awakeMinutes", t.sleep.awakeMinutes)
        val blePackets = JSONArray()
        t.recentBlePackets.forEach { pkt ->
            blePackets.put(
                JSONObject()
                    .put("timestampMs", pkt.timestampMs)
                    .put("uuid", pkt.uuid)
                    .put("hexPayload", pkt.hexPayload)
                    .put("parseHint", pkt.parseHint)
            )
        }
        return JSONObject()
            .put("heartRate", t.heartRate)
            .put("restingHeartRate", t.restingHeartRate)
            .put("spo2", t.spo2.toDouble())
            .put("bodyTempC", t.bodyTempC.toDouble())
            .put("systolic", t.systolic)
            .put("diastolic", t.diastolic)
            .put("hrvRmssd", t.hrvRmssd)
            .put("focusIndex", t.focusIndex)
            .put("autonomicState", t.autonomicState)
            .put("autonomicConfidence", t.autonomicConfidence)
            .put("autonomicStability", t.autonomicStability)
            .put("mentalLoad", t.mentalLoad)
            .put("cognitiveReadiness", t.cognitiveReadiness)
            .put("recoveryState", t.recoveryState)
            .put("sleepScore", t.sleepScore)
            .put("sleep", sleep)
            .put("stepsToday", t.stepsToday)
            .put("distanceKm", t.distanceKm.toDouble())
            .put("caloriesActive", t.caloriesActive)
            .put("barometricPressure", t.barometricPressure)
            .put("batteryLevel", t.batteryLevel)
            .put("batteryDaysRemaining", t.batteryDaysRemaining)
            .put("directHeartRate", t.directHeartRate)
            .put("directSpo2", t.directSpo2)
            .put("directTemperature", t.directTemperature)
            .put("directBloodPressure", t.directBloodPressure)
            .put("directBattery", t.directBattery)
            .put("connectedDeviceName", t.connectedDeviceName)
            .put("bleStatus", t.bleStatus)
            .put("bleConnected", t.bleConnected)
            .put("lastBlePacketAtMs", t.lastBlePacketAtMs)
            .put("focusTrend", intListJson(t.focusTrend))
            .put("hrvTrend", intListJson(t.hrvTrend))
            .put("hourlyActivity", intListJson(t.hourlyActivity))
            .put("vitalSparkline", intListJson(t.vitalSparkline))
            .put("blePackets", blePackets)
    }

    private fun validateRequiredTelemetry(payload: JSONObject) {
        val sessionMeta = payload.optJSONObject("sessionMeta")
            ?: error("Payload missing sessionMeta")
        val telemetrySnapshot = sessionMeta.optJSONObject("telemetrySnapshot")
            ?: error("Payload missing sessionMeta.telemetrySnapshot")
        val missing = requiredTelemetryKeys.filterNot { telemetrySnapshot.has(it) }
        if (missing.isNotEmpty()) {
            error("Payload missing required telemetry keys: ${missing.joinToString(", ")}")
        }
    }

    private fun findExistingSessionKeyByCaseId(caseId: String): String? {
        val endpoint = "$DATABASE_URL/$SESSIONS_PATH.json"
        val conn = URL(endpoint).openConnection() as HttpURLConnection
        conn.requestMethod = "GET"
        conn.connectTimeout = 15_000
        conn.readTimeout = 20_000
        if (conn.responseCode !in 200..299) return null
        val body = InputStreamReader(conn.inputStream).use { it.readText() }
        if (body.isBlank() || body == "null") return null
        val obj = JSONObject(body)
        val keys = obj.keys().asSequence().filter { key ->
            val session = obj.optJSONObject(key) ?: return@filter false
            session.optString("caseId") == caseId
        }.toList()
        if (keys.isEmpty()) return null
        return keys.maxByOrNull { key ->
            key.substringBefore('_').toLongOrNull() ?: 0L
        }
    }

    private fun putJson(url: String, body: String): Int {
        val conn = URL(url).openConnection() as HttpURLConnection
        conn.requestMethod = "PUT"
        conn.doOutput = true
        conn.setRequestProperty("Content-Type", "application/json")
        conn.connectTimeout = 15_000
        conn.readTimeout = 20_000
        BufferedWriter(OutputStreamWriter(conn.outputStream)).use { it.write(body) }
        return conn.responseCode
    }

    private fun patchJson(url: String, body: String): Int {
        val conn = URL(url).openConnection() as HttpURLConnection
        conn.requestMethod = "PATCH"
        conn.doOutput = true
        conn.setRequestProperty("Content-Type", "application/json")
        conn.connectTimeout = 15_000
        conn.readTimeout = 20_000
        BufferedWriter(OutputStreamWriter(conn.outputStream)).use { it.write(body) }
        return conn.responseCode
    }
}

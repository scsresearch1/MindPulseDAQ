package com.mindpulse.mindpulseui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Divider
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.mindpulse.mindpulseui.data.BleBandManager
import com.mindpulse.mindpulseui.data.BleDiscoveryPhase
import com.mindpulse.mindpulseui.data.DiscoveredBleDevice
import com.mindpulse.mindpulseui.data.FirebaseRtdbUploader
import com.mindpulse.mindpulseui.data.MindPulseTelemetryStore
import com.mindpulse.mindpulseui.data.ProvideTelemetry
import com.mindpulse.mindpulseui.data.TelemetryState
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private val fieldRegex = Regex("^\\d{6}$")
private const val CAPTURE_DURATION_MS = 60_000L
private const val PHYSICAL_SERIES_POINTS = 25
private const val PHYSICAL_SAMPLE_INTERVAL_MS = CAPTURE_DURATION_MS / PHYSICAL_SERIES_POINTS
private enum class DaqScreen { Connect, Capture }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MindPulseApp() {
    val context = LocalContext.current
    val telemetry by MindPulseTelemetryStore.state.collectAsState()
    val snackHost = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    var subjectName by remember { mutableStateOf("") }
    var caseId by remember { mutableStateOf("") }
    var uploading by remember { mutableStateOf(false) }
    var uploadDone by remember { mutableStateOf(false) }
    var screen by remember { mutableStateOf(DaqScreen.Connect) }
    var captureSessionId by remember { mutableStateOf(0) }
    var captureStartedAtMs by remember { mutableStateOf(0L) }
    var captureTick by remember { mutableStateOf(0L) }
    var physicalSeries by remember { mutableStateOf<List<FirebaseRtdbUploader.PhysicalTimePoint>>(emptyList()) }
    var showBandPicker by remember { mutableStateOf(false) }
    val appCtx = context.applicationContext
    val savedAddress = BleBandManager.lastSavedDeviceAddress(appCtx)

    val subjectAppliedToWrist =
        telemetry.bleConnected && (telemetry.directHeartRate || telemetry.directSpo2)

    LaunchedEffect(screen, captureSessionId, telemetry.directHeartRate, telemetry.directSpo2) {
        if (screen != DaqScreen.Capture) return@LaunchedEffect
        if (captureStartedAtMs != 0L) return@LaunchedEffect
        if (telemetry.directHeartRate || telemetry.directSpo2) {
            captureStartedAtMs = System.currentTimeMillis()
            captureTick = captureStartedAtMs
            physicalSeries = emptyList()
        }
    }

    LaunchedEffect(screen, telemetry.directHeartRate, telemetry.directSpo2) {
        if (screen != DaqScreen.Capture) return@LaunchedEffect
        if (!telemetry.directHeartRate && !telemetry.directSpo2 && captureStartedAtMs != 0L) {
            captureStartedAtMs = 0L
            physicalSeries = emptyList()
        }
    }

    LaunchedEffect(screen, captureStartedAtMs) {
        if (screen != DaqScreen.Capture || captureStartedAtMs == 0L) return@LaunchedEffect
        while (System.currentTimeMillis() - captureStartedAtMs < CAPTURE_DURATION_MS) {
            delay(1_000)
            captureTick = System.currentTimeMillis()
        }
        captureTick = System.currentTimeMillis()
    }
    LaunchedEffect(screen, captureSessionId, captureStartedAtMs, subjectAppliedToWrist) {
        if (screen != DaqScreen.Capture || captureStartedAtMs == 0L || !subjectAppliedToWrist) return@LaunchedEffect
        while (
            screen == DaqScreen.Capture &&
            subjectAppliedToWrist &&
            System.currentTimeMillis() - captureStartedAtMs <= CAPTURE_DURATION_MS &&
            physicalSeries.size < PHYSICAL_SERIES_POINTS
        ) {
            val sessionTimeMs = (System.currentTimeMillis() - captureStartedAtMs).coerceAtLeast(0L)
            val live = MindPulseTelemetryStore.state.value
            val point = FirebaseRtdbUploader.PhysicalTimePoint(
                sessionTimeMs = sessionTimeMs,
                heartRate = live.heartRate,
                restingHeartRate = live.restingHeartRate,
                spo2 = live.spo2.toDouble(),
                bodyTempC = live.bodyTempC.toDouble(),
                systolic = live.systolic,
                diastolic = live.diastolic,
                hrvRmssd = live.hrvRmssd,
                focusIndex = live.focusIndex,
                autonomicState = live.autonomicState,
                autonomicConfidence = live.autonomicConfidence,
                autonomicStability = live.autonomicStability,
                mentalLoad = live.mentalLoad,
                cognitiveReadiness = live.cognitiveReadiness,
                caloriesActive = live.caloriesActive,
                barometricPressure = live.barometricPressure
            )
            physicalSeries = physicalSeries + point
            delay(PHYSICAL_SAMPLE_INTERVAL_MS)
        }
    }

    val subjectValid = subjectName.trim().length >= 2
    val caseValid = fieldRegex.matches(caseId)
    val detailsValid = subjectValid && caseValid
    val hasCollectedPackets = telemetry.recentBlePackets.isNotEmpty()
    val elapsedCaptureMs =
        if (captureStartedAtMs > 0L) {
            (captureTick - captureStartedAtMs).coerceAtLeast(0L)
        } else 0L
    val captureWindowComplete = captureStartedAtMs > 0L && elapsedCaptureMs >= CAPTURE_DURATION_MS
    val remainingCaptureMs = (CAPTURE_DURATION_MS - elapsedCaptureMs).coerceAtLeast(0L)
    val remM = remainingCaptureMs / 60_000L
    val remS = (remainingCaptureMs % 60_000L) / 1_000L
    val canStore =
        telemetry.bleConnected &&
            subjectAppliedToWrist &&
            hasCollectedPackets &&
            detailsValid &&
            captureWindowComplete &&
            physicalSeries.size >= PHYSICAL_SERIES_POINTS &&
            !uploading

    ProvideTelemetry {
        Scaffold(
            containerColor = BgMidnight,
            snackbarHost = { SnackbarHost(hostState = snackHost) }
        ) { innerPadding ->
            Box(modifier = Modifier.fillMaxSize()) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        brush = Brush.verticalGradient(
                            listOf(BgMidnight, BgSlate, BgMidnight)
                        )
                    )
                    .padding(innerPadding)
                    .padding(16.dp)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(
                    text = "MindPulse DAQ",
                    style = MaterialTheme.typography.headlineMedium,
                    color = TextPrimary,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "2-Screen Flow: Connect -> Capture/Store",
                    color = TextSecondary
                )
                when (screen) {
                    DaqScreen.Connect -> {
                        StepCard(
                            title = "Screen 1: BLE Connection",
                            completed = telemetry.bleConnected
                        ) {
                            Text("Status: ${telemetry.bleStatus}", color = TextSecondary)
                            Text("Device: ${telemetry.connectedDeviceName}", color = TextSecondary)
                            Spacer(Modifier.height(8.dp))
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Button(
                                    onClick = {
                                        if (telemetry.bleConnected) {
                                            BleBandManager.disconnectCurrent(appCtx)
                                        }
                                        showBandPicker = true
                                    }
                                ) {
                                    Text(if (telemetry.bleConnected) "Change band" else "Find & connect band")
                                }
                                if (!savedAddress.isNullOrBlank() && !telemetry.bleConnected) {
                                    TextButton(
                                        onClick = { BleBandManager.connectToAddress(appCtx, savedAddress) }
                                    ) {
                                        Text("Saved band")
                                    }
                                }
                                Button(
                                    onClick = {
                                        captureSessionId++
                                        captureStartedAtMs = 0L
                                        physicalSeries = emptyList()
                                        screen = DaqScreen.Capture
                                    },
                                    enabled = telemetry.bleConnected,
                                    colors = ButtonDefaults.buttonColors(
                                        containerColor = PulseTeal,
                                        contentColor = BgMidnight
                                    )
                                ) {
                                    Text("Next")
                                }
                            }
                        }
                    }

                    DaqScreen.Capture -> {
                        StepCard(
                            title = "Screen 2: Subject + Capture + Store",
                            completed = uploadDone
                        ) {
                            OutlinedTextField(
                                value = subjectName,
                                onValueChange = { subjectName = it.take(40) },
                                label = { Text("Subject Name") },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth()
                            )
                            Spacer(Modifier.height(8.dp))
                            OutlinedTextField(
                                value = caseId,
                                onValueChange = { caseId = it.filter(Char::isDigit).take(6) },
                                label = { Text("6 Digit Case ID") },
                                supportingText = {
                                    Text(
                                        if (caseValid || caseId.isEmpty()) "Exactly 6 digits" else "Case ID must be 6 digits"
                                    )
                                },
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth()
                            )
                            Spacer(Modifier.height(10.dp))
                            if (!telemetry.bleConnected) {
                                Text(
                                    text = "Bluetooth link inactive. Return to the previous screen to establish a device connection.",
                                    color = AlertAmber,
                                    style = MaterialTheme.typography.bodyMedium
                                )
                            } else if (!subjectAppliedToWrist) {
                                Text(
                                    text = "Physiologic acquisition is paused. Position the sensor securely on the subject’s wrist with direct skin contact; live waveforms and metrics will populate once a stable on‑body signal is detected.",
                                    color = TextPrimary,
                                    style = MaterialTheme.typography.bodyMedium
                                )
                            } else {
                                TelemetryDataPanel(telemetry)
                            }
                            Spacer(Modifier.height(8.dp))
                            AcquisitionTimerCard(
                                subjectAppliedToWrist = subjectAppliedToWrist,
                                captureStartedAtMs = captureStartedAtMs,
                                captureWindowComplete = captureWindowComplete,
                                remM = remM,
                                remS = remS,
                                collected = physicalSeries.size,
                                required = PHYSICAL_SERIES_POINTS
                            )
                            Spacer(Modifier.height(10.dp))
                            Button(
                                onClick = {
                                    scope.launch {
                                        uploading = true
                                        val result = FirebaseRtdbUploader.storeTestData(
                                            telemetry = telemetry,
                                            participantName = subjectName.trim(),
                                            caseId = caseId,
                                            physicalTimeSeries = physicalSeries
                                        )
                                        uploading = false
                                        if (result.ok) {
                                            uploadDone = true
                                            snackHost.showSnackbar("Stored successfully for Case ID $caseId")
                                            subjectName = ""
                                            caseId = ""
                                            captureSessionId++
                                            captureStartedAtMs = 0L
                                            physicalSeries = emptyList()
                                        } else {
                                            snackHost.showSnackbar("Upload failed: ${result.message}")
                                        }
                                    }
                                },
                                enabled = canStore,
                                colors = ButtonDefaults.buttonColors(containerColor = PulseTeal, contentColor = BgMidnight)
                            ) {
                                if (uploading) {
                                    CircularProgressIndicator(color = BgMidnight, strokeWidth = 2.dp, modifier = Modifier.height(16.dp))
                                } else {
                                    Text("Store Test Data", fontWeight = FontWeight.Bold)
                                }
                            }
                            if (subjectAppliedToWrist && !hasCollectedPackets) {
                                Text("Awaiting telemetry frames from the sensor.", color = AlertAmber)
                            }
                            if (!detailsValid) Text("Enter valid subject and 6 digit case ID.", color = AlertAmber)
                            if (subjectAppliedToWrist && detailsValid && hasCollectedPackets && !captureWindowComplete) {
                                Text(
                                    text = "Store Test Data remains locked until the minimum on‑wrist acquisition interval has elapsed.",
                                    color = TextMuted,
                                    style = MaterialTheme.typography.bodySmall
                                )
                            }
                            if (subjectAppliedToWrist && captureWindowComplete && physicalSeries.size < PHYSICAL_SERIES_POINTS) {
                                Text(
                                    text = "Collecting physical time-series points: ${physicalSeries.size}/$PHYSICAL_SERIES_POINTS",
                                    color = TextMuted,
                                    style = MaterialTheme.typography.bodySmall
                                )
                            }
                            Spacer(Modifier.height(6.dp))
                            TextButton(onClick = {
                                captureSessionId++
                                captureStartedAtMs = 0L
                                physicalSeries = emptyList()
                                screen = DaqScreen.Connect
                            }) {
                                Text("Back to Connect Screen")
                            }
                        }
                    }
                }
            }
            if (showBandPicker) {
                DaqBandDiscoveryDialog(
                    onDismiss = {
                        showBandPicker = false
                        BleBandManager.stopDiscoveryOnly(appCtx)
                    },
                    onPicked = { showBandPicker = false }
                )
            }
            }
        }
    }
}

@Composable
private fun DaqBandDiscoveryDialog(
    onDismiss: () -> Unit,
    onPicked: () -> Unit
) {
    val context = LocalContext.current
    val appCtx = context.applicationContext
    val discovery by BleBandManager.discoveryState.collectAsState()

    LaunchedEffect(Unit) {
        BleBandManager.beginDeviceDiscovery(appCtx)
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Select MindPulse Band") },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = 360.dp)
            ) {
                if (discovery.phase == BleDiscoveryPhase.Scanning) {
                    LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
                    Text(
                        text = "Searching… (12s pass)",
                        modifier = Modifier.padding(top = 8.dp),
                        style = MaterialTheme.typography.bodySmall,
                        color = TextSecondary
                    )
                }
                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(min = 120.dp, max = 280.dp)
                ) {
                    items(discovery.devices, key = { it.address }) { item ->
                        DaqDeviceRow(device = item, onClick = {
                            BleBandManager.connectToAddress(appCtx, item.address)
                            onPicked()
                        })
                        Divider(color = Border.copy(alpha = 0.35f))
                    }
                }
                if (discovery.phase == BleDiscoveryPhase.Finished && discovery.devices.isEmpty()) {
                    Text(
                        text = "No MindPulse bands found. Move closer and tap Rescan.",
                        color = AlertAmber,
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.padding(top = 8.dp)
                    )
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    TextButton(onClick = { BleBandManager.beginDeviceDiscovery(appCtx) }) {
                        Text("Rescan")
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("Close")
            }
        }
    )
}

@Composable
private fun DaqDeviceRow(
    device: DiscoveredBleDevice,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(vertical = 10.dp, horizontal = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = device.displayName,
                color = TextPrimary,
                fontWeight = FontWeight.SemiBold,
                style = MaterialTheme.typography.bodyLarge
            )
            Text(
                text = device.address,
                color = TextMuted,
                style = MaterialTheme.typography.bodySmall
            )
        }
        Column(horizontalAlignment = Alignment.End) {
            Text(
                text = "${device.rssi} dBm",
                color = TextSecondary,
                style = MaterialTheme.typography.labelMedium
            )
            if (device.hasVendorService) {
                Text(
                    text = "MindPulse",
                    color = PulseTeal,
                    style = MaterialTheme.typography.labelSmall
                )
            }
        }
    }
}

@Composable
private fun StepCard(
    title: String,
    completed: Boolean,
    content: @Composable () -> Unit
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = BgCard),
        shape = RoundedCornerShape(18.dp),
        modifier = Modifier
            .fillMaxWidth()
            .border(
                width = 1.dp,
                color = if (completed) PulseTeal.copy(alpha = 0.55f) else Border,
                shape = RoundedCornerShape(18.dp)
            )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                Text(title, color = TextPrimary, fontWeight = FontWeight.SemiBold)
                Text(
                    if (completed) "READY" else "PENDING",
                    color = if (completed) CalmGreen else AlertAmber,
                    style = MaterialTheme.typography.labelMedium
                )
            }
            content()
        }
    }
}

@Composable
private fun AcquisitionTimerCard(
    subjectAppliedToWrist: Boolean,
    captureStartedAtMs: Long,
    captureWindowComplete: Boolean,
    remM: Long,
    remS: Long,
    collected: Int,
    required: Int
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = BgElevated),
        shape = RoundedCornerShape(14.dp),
        modifier = Modifier
            .fillMaxWidth()
            .border(
                width = 1.dp,
                color = if (captureWindowComplete) CalmGreen.copy(alpha = 0.6f) else PulseTeal.copy(alpha = 0.4f),
                shape = RoundedCornerShape(14.dp)
            )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Text("Acquisition Timer", color = TextSecondary, style = MaterialTheme.typography.labelMedium)
            if (!subjectAppliedToWrist) {
                Text(
                    text = "Waiting for on-wrist signal",
                    color = AlertAmber,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    text = "Timer starts automatically after stable skin-contact signal is detected.",
                    color = TextMuted,
                    style = MaterialTheme.typography.bodySmall
                )
            } else if (captureStartedAtMs <= 0L) {
                Text(
                    text = "Initializing...",
                    color = AlertAmber,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )
            } else if (captureWindowComplete) {
                Text(
                    text = "Ready to store",
                    color = CalmGreen,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    text = "Minimum 1-minute acquisition complete.",
                    color = TextMuted,
                    style = MaterialTheme.typography.bodySmall
                )
            } else {
                Text(
                    text = "${remM}:${remS.toString().padStart(2, '0')}",
                    color = PulseTeal,
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "Remaining before Store Test Data is enabled",
                    color = TextMuted,
                    style = MaterialTheme.typography.bodySmall
                )
            }
            Text(
                text = "Physical samples: $collected/$required",
                color = TextSecondary,
                style = MaterialTheme.typography.bodySmall
            )
        }
    }
}

@Composable
private fun DataRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.Top
    ) {
        Text(
            text = label,
            color = TextSecondary,
            style = MaterialTheme.typography.bodySmall,
            modifier = Modifier.weight(0.42f)
        )
        Text(
            text = value,
            color = TextPrimary,
            style = MaterialTheme.typography.bodySmall,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.weight(0.58f)
        )
    }
}

@Composable
private fun SectionTitle(text: String) {
    Spacer(Modifier.height(6.dp))
    Text(
        text = text,
        color = PulseTeal,
        style = MaterialTheme.typography.titleSmall,
        fontWeight = FontWeight.SemiBold
    )
    Spacer(Modifier.height(4.dp))
}

@Composable
private fun TelemetryDataPanel(t: TelemetryState) {
    SectionTitle("Vitals & load")
    DataRow("Heart rate", "${t.heartRate} bpm")
    DataRow("Resting heart rate", "${t.restingHeartRate} bpm")
    DataRow("SpO2", "%.2f %%".format(t.spo2))
    DataRow("Body temperature", "%.2f °C".format(t.bodyTempC))
    DataRow("Blood pressure", "${t.systolic} / ${t.diastolic} mmHg")
    DataRow("HRV RMSSD", "${t.hrvRmssd} ms")
    DataRow("Focus index", "${t.focusIndex}")
    DataRow("Mental load", t.mentalLoad)
    DataRow("Cognitive readiness", t.cognitiveReadiness)

    SectionTitle("Autonomic & recovery")
    DataRow("Autonomic state", t.autonomicState)
    DataRow("Autonomic confidence", "${t.autonomicConfidence} %")
    DataRow("Autonomic stability", t.autonomicStability)
    DataRow("Recovery state", t.recoveryState)

    SectionTitle("Sleep & activity")
    DataRow("Sleep score", "${t.sleepScore}")
    DataRow("Sleep total", "${t.sleep.totalMinutes} min")
    DataRow("Sleep deep / REM / light / awake", "${t.sleep.deepMinutes} / ${t.sleep.remMinutes} / ${t.sleep.lightMinutes} / ${t.sleep.awakeMinutes} min")
    DataRow("Steps today", "${t.stepsToday}")
    DataRow("Distance", "%.3f km".format(t.distanceKm))
    DataRow("Active calories", "${t.caloriesActive} kcal")
    DataRow("Barometric pressure", "${t.barometricPressure} hPa")

    SectionTitle("Device & BLE")
    DataRow("Battery", "${t.batteryLevel} %")
    DataRow("Battery days (est.)", "${t.batteryDaysRemaining}")
    DataRow("BLE connected", if (t.bleConnected) "yes" else "no")
    DataRow("BLE status", t.bleStatus)
    DataRow("Connected device", t.connectedDeviceName)
    DataRow("Last BLE packet (epoch ms)", "${t.lastBlePacketAtMs}")
    DataRow("BLE packet buffer size", "${t.recentBlePackets.size}")

    SectionTitle("Trends (samples)")
    DataRow("Focus trend", t.focusTrend.joinToString(", "))
    DataRow("HRV trend", t.hrvTrend.joinToString(", "))
    DataRow("Hourly activity", t.hourlyActivity.joinToString(", "))
    DataRow("Vital sparkline", t.vitalSparkline.joinToString(", "))

    // Intentionally hiding raw BLE frame dump in UI.
}

import https from "node:https";

const databaseUrl =
  "https://mindpulse-82eb0-default-rtdb.asia-southeast1.firebasedatabase.app";
const caseId = process.argv[2] ?? "123456";
const participantName = process.argv[3] ?? "TEMP_SUBJECT";
const sessionEndedAt = new Date().toISOString();
const entryKey = `${Date.now()}_${caseId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 20) || "id"}`;
const endpoint = `${databaseUrl}/mindpulse/v1/sessions/${entryKey}.json`;

const payload = {
  schemaVersion: 1,
  submittedAt: Date.now(),
  sessionEndedAt,
  caseId,
  participantName,
  age: 19,
  gender: "prefer_not",
  consent: {
    caseId,
    participantName,
    consentSubmittedAt: sessionEndedAt,
    allAccepted: true,
    consentVersion: 1,
  },
  sessionMeta: {
    sampleCount: 1,
    collectionMode: "ble_live",
    derivedFillAllowed: true,
    directFlags: {
      heartRate: true,
      spo2: true,
      temperature: false,
      bloodPressure: false,
      battery: true,
    },
    telemetrySnapshot: {
      heartRate: 78,
      spo2: 98,
      bodyTempC: 36.7,
      systolic: 119,
      diastolic: 78,
      batteryLevel: 86,
      bleStatus: "Connected",
      connectedDeviceName: "MindPulse Ring",
    },
  },
  emotionTimeSeries: [
    {
      caseId,
      sessionTimeMs: Date.now(),
      neutral: 0,
      happy: 0,
      fear: 0,
      surprise: 0,
      anger: 0,
      sadness: 0,
      disgust: 0,
      bleUuid: "0000fff7-0000-1000-8000-00805f9b34fb",
      bleHint: "temp_script_seed",
    },
  ],
};

const body = JSON.stringify(payload);

const req = https.request(
  endpoint,
  {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
    },
  },
  (res) => {
    let out = "";
    res.on("data", (chunk) => (out += chunk));
    res.on("end", () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        console.log(`Stored temp session: ${entryKey}`);
      } else {
        console.error(`Failed (${res.statusCode}): ${out}`);
        process.exitCode = 1;
      }
    });
  }
);

req.on("error", (err) => {
  console.error("Request failed:", err.message);
  process.exitCode = 1;
});

req.write(body);
req.end();

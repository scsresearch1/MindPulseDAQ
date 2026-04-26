import org.gradle.api.tasks.Copy

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val versionFile = file("${rootProject.projectDir}/version.txt")
val buildVersion = run {
    val v = if (versionFile.exists()) versionFile.readText().trim().toIntOrNull() ?: 1 else 1
    versionFile.writeText("${v + 1}\n")  // increment for next build
    v
}

android {
    namespace = "com.mindpulse.mindpulsedaq"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.mindpulse.MindPulseDAQ"
        minSdk = 26
        targetSdk = 34
        versionCode = buildVersion
        versionName = "$buildVersion"
    }

    signingConfigs {
        create("daq") {
            storeFile = file("${rootProject.projectDir}/signing/mindpulsedaq-release.jks")
            storePassword = "MindPulseDAQ@2026"
            keyAlias = "mindpulsedaq"
            keyPassword = "MindPulseDAQ@2026"
        }
    }
    buildTypes {
        debug {
            signingConfig = signingConfigs.getByName("daq")
        }
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            signingConfig = signingConfigs.getByName("daq")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
    }
    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.5"
    }
}

android.applicationVariants.all {
    val label = buildType.name.replaceFirstChar { if (it.isLowerCase()) it.titlecase() else it.toString() }
    outputs.all {
        (this as com.android.build.gradle.internal.api.BaseVariantOutputImpl).outputFileName =
            "MindPulseDAQ_${label}_V${buildVersion}.apk"
    }
}

tasks.register<Copy>("copyReleaseApkToMindPulse") {
    dependsOn("assembleRelease")
    from("$buildDir/outputs/apk/release/")
    into("F:/MindPulse/")
    include("MindPulseDAQ_Release_V*.apk")
    doNotTrackState("Destination may have permission restrictions")
}

tasks.register<Copy>("copyDebugApkToMindPulse") {
    dependsOn("assembleDebug")
    from("$buildDir/outputs/apk/debug/")
    into("F:/MindPulse/")
    include("MindPulseDAQ_Debug_V*.apk")
    doNotTrackState("Destination may have permission restrictions")
}

afterEvaluate {
    tasks.named("assembleRelease") {
        finalizedBy("copyReleaseApkToMindPulse")
    }
    tasks.named("assembleDebug") {
        finalizedBy("copyDebugApkToMindPulse")
    }
    tasks.named("createReleaseApkListingFileRedirect") {
        mustRunAfter("copyReleaseApkToMindPulse")
    }
    tasks.named("createDebugApkListingFileRedirect") {
        mustRunAfter("copyDebugApkToMindPulse")
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.6.2")
    implementation("androidx.activity:activity-compose:1.8.1")
    implementation(platform("androidx.compose:compose-bom:2023.10.01"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.work:work-runtime-ktx:2.9.0")
    implementation("androidx.datastore:datastore-preferences:1.0.0")
    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}

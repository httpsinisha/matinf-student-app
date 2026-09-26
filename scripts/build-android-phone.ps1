$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$jdk = 'C:/Program Files/Android/Android Studio/jbr'
if (-not (Test-Path -LiteralPath (Join-Path $jdk 'bin/java.exe'))) { throw 'Android Studio bundled JDK was not found. Adjust the $jdk path in this script.' }
$previousJavaHome = $env:JAVA_HOME
$previousAndroidHome = $env:ANDROID_HOME
$previousPath = $env:PATH
$previousNodeEnv = $env:NODE_ENV
Push-Location $projectRoot
try {
    $env:JAVA_HOME = $jdk
    $env:NODE_ENV = 'production'
    $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android/Sdk'
    $env:PATH = (Join-Path $jdk 'bin') + ';' + $env:PATH
    if (-not (Test-Path -LiteralPath 'android/gradlew.bat')) {
        & npx.cmd expo prebuild --platform android --no-install
        if ($LASTEXITCODE -ne 0) { throw 'Expo prebuild failed.' }
    }
    New-Item -ItemType Directory -Force -Path 'artifacts/build' | Out-Null
    Push-Location 'android'
    try {
        # Windows PowerShell treats native stderr warnings as error records.
        # Let Gradle finish and use its exit code to determine build success.
        $buildErrorPreference = $ErrorActionPreference
        try {
            $ErrorActionPreference = 'Continue'
            & ./gradlew.bat :app:assembleRelease '-PreactNativeArchitectures=arm64-v8a,x86_64' '--max-workers=1' '--console=plain' '--no-daemon' '-Dorg.gradle.jvmargs=-Xmx1536m -XX:MaxMetaspaceSize=1024m' *> ../artifacts/build/android-phone.log
            $buildExitCode = $LASTEXITCODE
        } finally { $ErrorActionPreference = $buildErrorPreference }
        if ($buildExitCode -ne 0) { throw 'Android build failed. See artifacts/build/android-phone.log.' }
    } finally { Pop-Location }
    Copy-Item -LiteralPath 'android/app/build/outputs/apk/release/app-release.apk' -Destination 'artifacts/build/MATINF-phone.apk' -Force
    Write-Output 'Created artifacts/build/MATINF-phone.apk'
    Write-Output 'Phone testing APK: arm64-v8a and x86_64, bundled JS, local testing signature.'
} finally {
    $env:JAVA_HOME = $previousJavaHome
    $env:ANDROID_HOME = $previousAndroidHome
    $env:PATH = $previousPath
    $env:NODE_ENV = $previousNodeEnv
    Pop-Location
}

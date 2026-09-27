allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}

subprojects {
    // Inject flutter configuration for older plugins that look for project.ext.flutter
    if (!extensions.extraProperties.has("flutter")) {
        extensions.extraProperties.set("flutter", mapOf(
            "compileSdkVersion" to 34,
            "minSdkVersion" to 21,
            "targetSdkVersion" to 34
        ))
    }
}

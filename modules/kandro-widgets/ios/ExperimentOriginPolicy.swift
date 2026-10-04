import Foundation

// A measurement filter only: never used to grant or deny app access.
enum KandroExperimentOriginPolicy {
  static let productionBundle = "com.hewaddorani.kandro"
  static func classify(verified: Bool, bundleID: String?, environment: String) -> String {
    guard verified, bundleID == productionBundle else { return "unknown" }
    switch environment {
    case "production": return "production"
    case "sandbox", "xcode": return "test"
    default: return "unknown"
    }
  }
}

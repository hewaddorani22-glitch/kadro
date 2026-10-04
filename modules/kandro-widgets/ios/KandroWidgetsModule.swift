import ExpoModulesCore
import WidgetKit
import StoreKit

public class KandroWidgetsModule: Module {
  private let lock = NSLock()
  private var generation = UUID().uuidString
  private let kinds = ["KandroToday", "KandroEntry", "KandroPhoto"]
  private func reload() { for kind in kinds { WidgetCenter.shared.reloadTimelines(ofKind: kind) } }
  public func definition() -> ModuleDefinition {
    Name("KandroWidgets")
    // JS calls this only after a separate optional analytics consent. StoreKit
    // may contact Apple; no receipt, transaction/account identifier or device
    // verification data is read into JS, stored by Kandro or uploaded elsewhere.
    AsyncFunction("experimentInstallOrigin") { () async -> String in
      #if DEBUG || targetEnvironment(simulator)
      return "test"
      #else
      guard Bundle.main.bundleIdentifier == KandroExperimentOriginPolicy.productionBundle else { return "unknown" }
      guard #available(iOS 16.0, *) else { return "unknown" }
      do {
        let result = try await AppTransaction.shared
        guard case .verified(let transaction) = result else { return "unknown" }
        let environment = transaction.environment == .production ? "production"
          : transaction.environment == .sandbox ? "sandbox"
          : transaction.environment == .xcode ? "xcode" : "unknown"
        return KandroExperimentOriginPolicy.classify(verified: true, bundleID: transaction.bundleID, environment: environment)
      } catch { return "unknown" }
      #endif
    }
    Function("invalidate") { () throws -> String in
      self.lock.lock(); defer { self.lock.unlock(); self.reload() }
      self.generation = UUID().uuidString
      guard let url = KandroWidgetSnapshot.fileURL() else { throw Exception(name: "WidgetGroupUnavailable", description: "Widget sharing is unavailable in this build.") }
      if FileManager.default.fileExists(atPath: url.path) { try FileManager.default.removeItem(at: url) }
      return self.generation
    }
    Function("writeSnapshot") { (json: String, expectedGeneration: String) throws -> Bool in
      self.lock.lock(); defer { self.lock.unlock() }
      guard expectedGeneration == self.generation else { return false }
      let data = Data(json.utf8)
      guard data.count <= 4096 else { return false }
      let snapshot = try JSONDecoder().decode(KandroWidgetSnapshot.self, from: data)
      guard snapshot.generation == self.generation, snapshot.valid(at: Date()), let url = KandroWidgetSnapshot.fileURL() else { return false }
      // Re-encode the whitelist. Never copy arbitrary JS fields to the group.
      let safeData = try JSONEncoder().encode(snapshot)
      try safeData.write(to: url, options: [.atomic, .completeFileProtection])
      self.reload()
      return true
    }
  }
}

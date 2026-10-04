import ExpoModulesCore
import WidgetKit

public class KandroWidgetsModule: Module {
  private let lock = NSLock()
  private var generation = UUID().uuidString
  private let kinds = ["KandroToday", "KandroEntry", "KandroPhoto"]
  private func reload() { for kind in kinds { WidgetCenter.shared.reloadTimelines(ofKind: kind) } }
  public func definition() -> ModuleDefinition {
    Name("KandroWidgets")
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
